import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { log_ids } = await req.json();

    if (!log_ids || !Array.isArray(log_ids) || log_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "log_ids array is required" }),
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

    // Step 1: Fetch logs that need transcription
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

    // Step 2: For each log without a transcript, download audio and transcribe
    const transcripts: string[] = [];

    for (const log of logs) {
      if (log.transcript) {
        transcripts.push(log.transcript);
        continue;
      }

      // Mark as transcribing
      await supabase
        .from("voice_logs")
        .update({ status: "transcribing" })
        .eq("id", log.id);

      // Download audio from storage
      const { data: audioData, error: downloadError } = await supabase.storage
        .from("recordings")
        .download(log.audio_path);

      if (downloadError || !audioData) {
        console.error("Failed to download audio:", downloadError);
        await supabase
          .from("voice_logs")
          .update({ status: "error" })
          .eq("id", log.id);
        continue;
      }

      // Convert audio to base64 for AI (chunked to avoid stack overflow)
      const arrayBuffer = await audioData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const base64Audio = btoa(binary);

      // Transcribe via Lovable AI (Gemini supports audio)
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
                content:
                  "You are a transcription engine for construction site voice logs. Transcribe the audio exactly as spoken. Output ONLY the transcription text, no commentary.",
              },
              {
                role: "user",
                content: [
                  {
                    type: "input_audio",
                    input_audio: {
                      data: base64Audio,
                      format: "webm",
                    },
                  },
                  {
                    type: "text",
                    text: "Transcribe this construction site voice log.",
                  },
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
            JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await supabase
          .from("voice_logs")
          .update({ status: "error" })
          .eq("id", log.id);
        continue;
      }

      const transcribeResult = await transcribeResponse.json();
      const transcript =
        transcribeResult.choices?.[0]?.message?.content?.trim() || "";

      // Save transcript
      await supabase
        .from("voice_logs")
        .update({ transcript, status: "transcribed" })
        .eq("id", log.id);

      transcripts.push(transcript);
    }

    if (transcripts.length === 0) {
      return new Response(
        JSON.stringify({ error: "No transcripts could be generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Generate structured report from all transcripts
    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
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
              content: `Generate a daily site report for ${today} from these ${transcripts.length} voice log transcriptions:\n\n${transcripts
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
    const reportContent =
      reportResult.choices?.[0]?.message?.content?.trim() || "";

    // Save report
    const { data: report, error: reportError } = await supabase
      .from("daily_reports")
      .insert({
        content: reportContent,
        log_ids: log_ids,
        report_date: new Date().toISOString().split("T")[0],
      })
      .select()
      .single();

    if (reportError) throw reportError;

    return new Response(JSON.stringify({ report }), {
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
