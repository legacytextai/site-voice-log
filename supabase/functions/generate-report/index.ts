import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Minimal PDF generator: produces a valid PDF with text content
function generatePdfBytes(title: string, content: string): Uint8Array {
  const lines = content.split("\n");
  const pageHeight = 842; // A4
  const pageWidth = 595;
  const margin = 50;
  const lineHeight = 14;
  const maxCharsPerLine = 80;
  const usableHeight = pageHeight - 2 * margin;
  const linesPerPage = Math.floor(usableHeight / lineHeight);

  // Word-wrap lines
  const wrappedLines: string[] = [];
  for (const line of lines) {
    if (line.length === 0) {
      wrappedLines.push("");
      continue;
    }
    let remaining = line;
    while (remaining.length > maxCharsPerLine) {
      let breakAt = remaining.lastIndexOf(" ", maxCharsPerLine);
      if (breakAt <= 0) breakAt = maxCharsPerLine;
      wrappedLines.push(remaining.substring(0, breakAt));
      remaining = remaining.substring(breakAt).trimStart();
    }
    wrappedLines.push(remaining);
  }

  // Split into pages
  const pages: string[][] = [];
  for (let i = 0; i < wrappedLines.length; i += linesPerPage) {
    pages.push(wrappedLines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push([""]);

  // Escape PDF special chars
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  let objCount = 0;
  const objects: string[] = [];
  const offsets: number[] = [];

  const addObj = (content: string) => {
    objCount++;
    objects.push(`${objCount} 0 obj\n${content}\nendobj\n`);
    return objCount;
  };

  // 1: Catalog
  addObj(`<< /Type /Catalog /Pages 2 0 R >>`);

  // 2: Pages (placeholder, we'll fix references)
  const pagesObjId = objCount + 1;
  addObj(`<< /Type /Pages /Kids [${pages.map((_, i) => `${pagesObjId + 1 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`);

  // 3: Font
  const fontId = addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>`);

  // Page objects + content streams
  for (const pageLines of pages) {
    const textOps: string[] = [];
    textOps.push("BT");
    textOps.push(`/F1 10 Tf`);
    textOps.push(`${margin} ${pageHeight - margin} Td`);
    textOps.push(`0 -${lineHeight} Td`);

    for (const line of pageLines) {
      textOps.push(`(${esc(line)}) Tj`);
      textOps.push(`0 -${lineHeight} Td`);
    }
    textOps.push("ET");

    const stream = textOps.join("\n");
    const streamId = addObj(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    // Page object (added after stream so IDs work out — but we pre-calculated in Pages kids)
    // Actually let's restructure: page first, then stream
  }

  // Rebuild properly
  objCount = 0;
  objects.length = 0;

  // Obj 1: Catalog
  addObj(`<< /Type /Catalog /Pages 2 0 R >>`);

  // Calculate object IDs: font=3, then for each page: pageObj, contentStream
  const fontObjId = 3;
  const pageObjIds: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    pageObjIds.push(4 + i * 2); // page obj
  }

  // Obj 2: Pages
  addObj(`<< /Type /Pages /Kids [${pageObjIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);

  // Obj 3: Font
  addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>`);

  // Pages + streams
  for (let p = 0; p < pages.length; p++) {
    const pageLines = pages[p];
    const contentObjId = 4 + p * 2 + 1;

    // Page object
    addObj(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentObjId} 0 R /Resources << /Font << /F1 ${fontObjId} 0 R >> >> >>`);

    // Content stream
    const textOps: string[] = [];
    textOps.push("BT");
    textOps.push(`/F1 10 Tf`);
    let y = pageHeight - margin;
    textOps.push(`${margin} ${y} Td`);

    for (const line of pageLines) {
      textOps.push(`(${esc(line)}) Tj`);
      textOps.push(`0 -${lineHeight} Td`);
    }
    textOps.push("ET");

    const stream = textOps.join("\n");
    addObj(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }

  // Build PDF
  let pdf = "%PDF-1.4\n";
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += objects[i];
  }

  const xrefOffset = pdf.length;
  pdf += "xref\n";
  pdf += `0 ${objCount + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += "trailer\n";
  pdf += `<< /Size ${objCount + 1} /Root 1 0 R >>\n`;
  pdf += "startxref\n";
  pdf += `${xrefOffset}\n`;
  pdf += "%%EOF\n";

  return new TextEncoder().encode(pdf);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { log_ids, user_id, project_name } = await req.json();
    const projectName = (project_name || "").trim() || "Untitled Project";

    if (!log_ids || !Array.isArray(log_ids) || log_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "log_ids array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user email
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("email")
      .eq("id", user_id)
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userEmail = userData.email;

    // Fetch logs
    const { data: logs, error: logsError } = await supabase
      .from("voice_logs")
      .select("*")
      .in("id", log_ids)
      .order("recorded_at", { ascending: true });

    if (logsError) throw logsError;
    if (!logs || logs.length === 0) {
      return new Response(
        JSON.stringify({ error: "No logs found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transcribe logs without transcripts
    const transcripts: string[] = [];

    for (const log of logs) {
      if (log.transcript) {
        transcripts.push(log.transcript);
        // Upload existing transcript to storage
        const logDate = new Date(log.recorded_at).toISOString().split("T")[0];
        const txtPath = `${logDate}/${userEmail}/${log.id}.txt`;
        console.log("Uploading existing transcript to:", txtPath);
        const { error: txtUploadErr } = await supabase.storage.from("transcripts").upload(txtPath, new TextEncoder().encode(log.transcript), {
          contentType: "text/plain",
          upsert: true,
        });
        if (txtUploadErr) console.error("Transcript upload failed:", txtUploadErr);
        continue;
      }

      await supabase.from("voice_logs").update({ status: "transcribing" }).eq("id", log.id);

      const { data: audioData, error: downloadError } = await supabase.storage
        .from("recordings")
        .download(log.audio_path);

      if (downloadError || !audioData) {
        console.error("Failed to download audio:", downloadError);
        await supabase.from("voice_logs").update({ status: "error" }).eq("id", log.id);
        continue;
      }

      const arrayBuffer = await audioData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const base64Audio = btoa(binary);

      const transcribeResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: "You are a transcription engine for construction site voice logs. Transcribe the audio exactly as spoken. Output ONLY the transcription text, no commentary.",
              },
              {
                role: "user",
                content: [
                  { type: "input_audio", input_audio: { data: base64Audio, format: "webm" } },
                  { type: "text", text: "Transcribe this construction site voice log." },
                ],
              },
            ],
          }),
        }
      );

      if (!transcribeResponse.ok) {
        const errText = await transcribeResponse.text();
        console.error("Transcription failed:", transcribeResponse.status, errText);

        if (transcribeResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limited. Please try again in a moment." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (transcribeResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: "AI credits exhausted." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await supabase.from("voice_logs").update({ status: "error" }).eq("id", log.id);
        continue;
      }

      const transcribeResult = await transcribeResponse.json();
      const transcript = transcribeResult.choices?.[0]?.message?.content?.trim() || "";

      await supabase.from("voice_logs").update({ transcript, status: "transcribed" }).eq("id", log.id);
      transcripts.push(transcript);

      // Upload transcript to storage
      const logDate = new Date(log.recorded_at).toISOString().split("T")[0];
      const txtPath = `${logDate}/${userEmail}/${log.id}.txt`;
      console.log("Uploading new transcript to:", txtPath);
      const { error: txtUploadErr2 } = await supabase.storage.from("transcripts").upload(txtPath, new TextEncoder().encode(transcript), {
        contentType: "text/plain",
        upsert: true,
      });
      if (txtUploadErr2) console.error("Transcript upload failed:", txtUploadErr2);
    }

    if (transcripts.length === 0) {
      return new Response(
        JSON.stringify({ error: "No transcripts could be generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate report
    const todayStr = new Date().toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });

    const reportResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are a construction daily report generator. You produce formal, structured daily site reports from voice log transcriptions.

Output format:
DAILY SITE REPORT — [DATE]
PROJECT: [PROJECT NAME]

WEATHER & CONDITIONS:
(Infer from context or state "Not reported")

WORK PERFORMED:
- Bullet points of activities mentioned

MATERIALS & EQUIPMENT:
- Items mentioned or "None reported"

PERSONNEL:
- Names/trades mentioned or "Not specified"

SAFETY OBSERVATIONS:
- Any safety items mentioned or "None reported"

ISSUES / DELAYS:
- Problems mentioned or "None reported"

NOTES:
- Any additional context

— End of Report —

Be factual. No embellishment. If information isn't in the transcripts, say "Not reported." This is documentation-grade output.`,
            },
            {
              role: "user",
              content: `Generate a daily site report for ${todayStr}.\nPROJECT: ${projectName}\n\nVoice log transcriptions (${transcripts.length}):\n\n${transcripts
                .map((t, i) => `--- Log ${i + 1} ---\n${t}`)
                .join("\n\n")}`,
            },
          ],
        }),
      }
    );

    if (!reportResponse.ok) {
      const errText = await reportResponse.text();
      console.error("Report generation failed:", reportResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "Failed to generate report" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reportResult = await reportResponse.json();
    const reportContent = reportResult.choices?.[0]?.message?.content?.trim() || "";

    // Generate PDF
    const reportDate = new Date().toISOString().split("T")[0];
    const pdfBytes = generatePdfBytes(`SiteLog Daily Report — ${projectName} — ${todayStr}`, reportContent);
    const sanitizedName = projectName.replace(/[^a-zA-Z0-9 \-]/g, "").trim().replace(/\s+/g, " ");
    const pdfPath = `${reportDate}/${sanitizedName}_Daily Report_${reportDate}.pdf`;

    // Upload PDF (upsert via overwrite)
    const { error: pdfUploadError } = await supabase.storage
      .from("report-pdfs")
      .upload(pdfPath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (pdfUploadError) {
      console.error("PDF upload failed:", pdfUploadError);
    }

    const pdfUrl = `${supabaseUrl}/storage/v1/object/public/report-pdfs/${pdfPath}`;

    // Upsert daily_reports
    const { data: existingReport } = await supabase
      .from("daily_reports")
      .select("id")
      .eq("user_id", user_id)
      .eq("report_date", reportDate)
      .maybeSingle();

    let report;
    if (existingReport) {
      const { data, error } = await supabase
        .from("daily_reports")
        .update({ content: reportContent, log_ids: log_ids, pdf_url: pdfUrl })
        .eq("id", existingReport.id)
        .select()
        .single();
      if (error) throw error;
      report = data;
    } else {
      const { data, error } = await supabase
        .from("daily_reports")
        .insert({
          content: reportContent,
          log_ids: log_ids,
          report_date: reportDate,
          user_id: user_id,
          pdf_url: pdfUrl,
        })
        .select()
        .single();
      if (error) throw error;
      report = data;
    }

    // Upsert admin_reports
    const { data: existingAdmin } = await supabase
      .from("admin_reports")
      .select("id, status")
      .eq("user_id", user_id)
      .eq("report_date", reportDate)
      .maybeSingle();

    if (existingAdmin) {
      const updateData: Record<string, string> = {
        pdf_url: pdfUrl,
        user_email: userEmail,
        project_name: projectName,
      };
      // Don't overwrite status if already 'sent'
      if (existingAdmin.status !== "sent") {
        updateData.status = "pending_sent";
      }
      await supabase
        .from("admin_reports")
        .update(updateData)
        .eq("id", existingAdmin.id);
    } else {
      await supabase.from("admin_reports").insert({
        user_id,
        user_email: userEmail,
        report_date: reportDate,
        pdf_url: pdfUrl,
        project_name: projectName,
        status: "pending_sent",
      });
    }

    return new Response(JSON.stringify({ report: { ...report, pdf_url: pdfUrl } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
