import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  generatePdfBytes,
  buildBackupLog,
  isSentinel,
  DEFAULT_BACKUP_TZ,
  type VoiceLogForBackup,
} from "../_shared/pdf.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Helper: resolve authenticated user_id from JWT
async function resolveUserId(req: Request, supabaseUrl: string, anonKey: string, serviceClient: any): Promise<{ user_id: string; error?: never } | { user_id?: never; error: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      error: new Response(JSON.stringify({ error: "Unauthorized — missing or invalid Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authError } = await anonClient.auth.getUser();
  if (authError || !authData?.user) {
    return {
      error: new Response(JSON.stringify({ error: "Unauthorized — invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  const authUid = authData.user.id;
  const authEmail = authData.user.email;

  // Look up internal user by auth_id
  const { data: userData, error: userError } = await serviceClient
    .from("users")
    .select("id, email")
    .eq("auth_id", authUid)
    .maybeSingle();

  if (userError) {
    console.error("User lookup error:", userError);
    return {
      error: new Response(JSON.stringify({ error: "Failed to resolve user" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  if (userData) {
    return { user_id: userData.id };
  }

  // No user row with this auth_id — try to bind by email
  if (authEmail) {
    const { data: emailUser } = await serviceClient
      .from("users")
      .select("id, auth_id")
      .eq("email", authEmail)
      .maybeSingle();

    if (emailUser && !emailUser.auth_id) {
      // Bind auth_id to existing user row
      await serviceClient
        .from("users")
        .update({ auth_id: authUid })
        .eq("id", emailUser.id);
      return { user_id: emailUser.id };
    }

    if (emailUser && emailUser.auth_id) {
      // Email exists but bound to different auth — reject
      return {
        error: new Response(JSON.stringify({ error: "Email already linked to another account" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }),
      };
    }
  }

  // Create new user row
  const { data: newUser, error: createError } = await serviceClient
    .from("users")
    .insert({ email: authEmail || "unknown", auth_id: authUid })
    .select("id")
    .single();

  if (createError || !newUser) {
    console.error("User creation error:", createError);
    return {
      error: new Response(JSON.stringify({ error: "Failed to create user profile" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  return { user_id: newUser.id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const reqBody = await req.json();
    const { log_ids, project_name, report_date: inputReportDate } = reqBody;
    const projectName = (project_name || "").trim() || "Untitled Project";
    // TEMPORARY: client may pass `timezone` (IANA). Defaults to America/Los_Angeles
    // until the next App Store update wires the mobile client to send it.
    const timezone: string =
      typeof reqBody.timezone === "string" && reqBody.timezone.trim()
        ? reqBody.timezone
        : DEFAULT_BACKUP_TZ;

    if (!log_ids || !Array.isArray(log_ids) || log_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "log_ids array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Resolve user_id from JWT instead of trusting client
    const resolved = await resolveUserId(req, supabaseUrl, anonKey, supabase);
    if (resolved.error) return resolved.error;
    const user_id = resolved.user_id;

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

    // Process logs: transcribe or skip based on guardrails
    const transcripts: string[] = [];
    const usableLogs: VoiceLogForBackup[] = [];

    for (const log of logs) {
      if (log.duration_seconds < 3) {
        const sentinel = "Recording too short for reliable transcription.";
        console.log(`[GUARD] Log ${log.id}: duration ${log.duration_seconds}s < 3s — skipping transcription`);
        await supabase.from("voice_logs").update({ transcript: sentinel, status: "skipped" }).eq("id", log.id);
        continue;
      }

      if (log.transcript) {
        if (isSentinel(log.transcript)) {
          console.log(`[GUARD] Log ${log.id}: existing sentinel transcript — excluding`);
          continue;
        }

        const wordCount = log.transcript.split(/\s+/).filter((w: string) => w.length > 0).length;
        const wps = wordCount / Math.max(log.duration_seconds, 1);
        if (wps > 5) {
          const sentinel = "Unreliable transcription — excluded from report.";
          console.log(`[GUARD] Log ${log.id}: ${wordCount} words in ${log.duration_seconds}s (${wps.toFixed(1)} wps) — unreliable`);
          await supabase.from("voice_logs").update({ transcript: sentinel, status: "unreliable" }).eq("id", log.id);
          continue;
        }

        transcripts.push(log.transcript);
        usableLogs.push({ recorded_at: log.recorded_at, transcript: log.transcript });

        const logDate = new Date(log.recorded_at).toISOString().split("T")[0];
        const txtPath = `${logDate}/${userEmail}/${log.id}.txt`;
        await supabase.storage.from("transcripts").upload(txtPath, new TextEncoder().encode(log.transcript), {
          contentType: "text/plain",
          upsert: true,
        });
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

      if (arrayBuffer.byteLength < 1024) {
        const sentinel = "No usable audio detected.";
        console.log(`[GUARD] Log ${log.id}: audio size ${arrayBuffer.byteLength} bytes < 1KB — skipping`);
        await supabase.from("voice_logs").update({ transcript: sentinel, status: "skipped" }).eq("id", log.id);
        continue;
      }

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
                content: `You are a verbatim transcription engine. Transcribe ONLY speech that is clearly audible.
Rules:
- If no speech is detected, respond EXACTLY: "Unclear or no speech detected."
- If speech is partially unclear, transcribe only the clear parts.
- Do NOT invent, infer, or fabricate any content.
- Do NOT generate plausible filler text.
- Do NOT add names, dates, locations, or details that are not clearly spoken.
- Output ONLY what was clearly spoken — nothing more.`,
              },
              {
                role: "user",
                content: [
                  { type: "input_audio", input_audio: { data: base64Audio, format: "webm" } },
                  { type: "text", text: "Transcribe this audio. If no clear speech is present, respond exactly: \"Unclear or no speech detected.\"" },
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
      let transcript = transcribeResult.choices?.[0]?.message?.content?.trim() || "";

      if (transcript && !isSentinel(transcript)) {
        const wordCount = transcript.split(/\s+/).filter((w: string) => w.length > 0).length;
        const wps = wordCount / Math.max(log.duration_seconds, 1);
        if (wps > 5) {
          console.log(`[GUARD] Log ${log.id}: transcription produced ${wordCount} words for ${log.duration_seconds}s (${wps.toFixed(1)} wps) — marking unreliable`);
          transcript = "Unreliable transcription — excluded from report.";
          await supabase.from("voice_logs").update({ transcript, status: "unreliable" }).eq("id", log.id);
          continue;
        }
      }

      await supabase.from("voice_logs").update({ transcript, status: "transcribed" }).eq("id", log.id);

      if (!isSentinel(transcript)) {
        transcripts.push(transcript);
        usableLogs.push({ recorded_at: log.recorded_at, transcript });
      }

      const logDate = new Date(log.recorded_at).toISOString().split("T")[0];
      const txtPath = `${logDate}/${userEmail}/${log.id}.txt`;
      await supabase.storage.from("transcripts").upload(txtPath, new TextEncoder().encode(transcript), {
        contentType: "text/plain",
        upsert: true,
      });
    }

    // --- If no valid transcripts, return empty report ---
    if (transcripts.length === 0) {
      const emptyReport = "DAILY SITE REPORT\n\nNo activities reported. No usable field logs recorded.\n\n— End of Report —";

      const reportDate = inputReportDate || new Date().toISOString().split("T")[0];
      const pdfBytes = generatePdfBytes(`FieldLog Daily Report — ${projectName}`, emptyReport);
      const sanitizedName = projectName.replace(/[^a-zA-Z0-9 \-]/g, "").trim().replace(/\s+/g, " ");
      const pdfPath = `${reportDate}/${sanitizedName}_Daily Report_${reportDate}.pdf`;

      await supabase.storage.from("report-pdfs").upload(pdfPath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

      const pdfUrl = `${supabaseUrl}/storage/v1/object/public/report-pdfs/${pdfPath}`;

      const { data: existingReport } = await supabase
        .from("daily_reports")
        .select("id")
        .eq("user_id", user_id)
        .eq("report_date", reportDate)
        .eq("project_name", projectName)
        .maybeSingle();

      let report;
      if (existingReport) {
        const { data, error } = await supabase
          .from("daily_reports")
          .update({ content: emptyReport, log_ids, pdf_url: pdfUrl, user_email: userEmail, project_name: projectName })
          .eq("id", existingReport.id)
          .select()
          .single();
        if (error) throw error;
        report = data;
      } else {
        const { data, error } = await supabase
          .from("daily_reports")
          .insert({ content: emptyReport, log_ids, report_date: reportDate, user_id, pdf_url: pdfUrl, user_email: userEmail, project_name: projectName })
          .select()
          .single();
        if (error) throw error;
        report = data;
      }

      return new Response(JSON.stringify({ report: { ...report, pdf_url: pdfUrl } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate report with trusted transcripts only
    const reportDate = inputReportDate || new Date().toISOString().split("T")[0];
    const reportDateObj = inputReportDate ? new Date(inputReportDate + "T00:00:00") : new Date();
    const todayStr = reportDateObj.toLocaleDateString("en-US", {
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

STRICT GROUNDING RULES:
- ONLY include information explicitly stated in the transcripts.
- NEVER infer, fabricate, or embellish names, dates, weather, activities, or events.
- If a section has no relevant transcript data, write "Not reported."
- Do NOT generate a plausible construction narrative — report ONLY what was said.
- Do NOT add details that sound realistic but were not in the transcripts.
- If a transcript is vague or incomplete, report it as-is — do not fill gaps.

Output format:
DAILY SITE REPORT — [DATE]
PROJECT: [PROJECT NAME]

WEATHER & CONDITIONS:
(Only if explicitly mentioned in transcripts, otherwise "Not reported")

WORK PERFORMED:
- Only activities explicitly described in transcripts
- If none mentioned, write "Not reported"

MATERIALS & EQUIPMENT:
- Only items explicitly mentioned or "Not reported"

PERSONNEL:
- Only names/trades explicitly mentioned or "Not reported"

SAFETY OBSERVATIONS:
- Only safety items explicitly mentioned or "Not reported"

ISSUES / DELAYS:
- Only problems explicitly mentioned or "Not reported"

NOTES:
- Any additional context directly from transcripts

— End of Report —

Be factual. No embellishment. This is documentation-grade output.`,
            },
            {
              role: "user",
              content: `Generate a daily site report for ${todayStr}.\nPROJECT: ${projectName}\n\nVoice log transcriptions (${transcripts.length} verified logs):\n\n${transcripts
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
    const pdfBytes = generatePdfBytes(`FieldLog Daily Report — ${projectName} — ${todayStr}`, reportContent);
    const sanitizedName = projectName.replace(/[^a-zA-Z0-9 \-]/g, "").trim().replace(/\s+/g, " ");
    const pdfPath = `${reportDate}/${sanitizedName}_Daily Report_${reportDate}.pdf`;

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
      .eq("project_name", projectName)
      .maybeSingle();

    let report;
    if (existingReport) {
      const { data, error } = await supabase
        .from("daily_reports")
        .update({ content: reportContent, log_ids, pdf_url: pdfUrl, user_email: userEmail, project_name: projectName })
        .eq("id", existingReport.id)
        .select()
        .single();
      if (error) throw error;
      report = data;
    } else {
      const { data, error } = await supabase
        .from("daily_reports")
        .insert({ content: reportContent, log_ids, report_date: reportDate, user_id, pdf_url: pdfUrl, user_email: userEmail, project_name: projectName })
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
      .eq("project_name", projectName)
      .maybeSingle();

    if (existingAdmin) {
      const updateData: Record<string, string> = {
        pdf_url: pdfUrl,
        user_email: userEmail,
        project_name: projectName,
      };
      if (existingAdmin.status !== "sent") {
        updateData.status = "pending_sent";
      }
      await supabase.from("admin_reports").update(updateData).eq("id", existingAdmin.id);
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
