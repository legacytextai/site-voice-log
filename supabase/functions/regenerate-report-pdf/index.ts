import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  generatePdfBytes,
  buildBackupLog,
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

  const { data: userData, error: userError } = await serviceClient
    .from("users")
    .select("id, email")
    .eq("auth_id", authUid)
    .maybeSingle();

  if (userError) {
    return {
      error: new Response(JSON.stringify({ error: "Failed to resolve user" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  if (userData) return { user_id: userData.id };

  if (authEmail) {
    const { data: emailUser } = await serviceClient
      .from("users")
      .select("id, auth_id")
      .eq("email", authEmail)
      .maybeSingle();

    if (emailUser && !emailUser.auth_id) {
      await serviceClient.from("users").update({ auth_id: authUid }).eq("id", emailUser.id);
      return { user_id: emailUser.id };
    }
  }

  return {
    error: new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { project_name, report_date, content } = body;
    // Optional client-supplied timezone (future: passed by mobile app once OTA-capable).
    // TEMPORARY: defaults to America/Los_Angeles until next App Store update.
    const timezone: string = (body.timezone && typeof body.timezone === "string")
      ? body.timezone
      : DEFAULT_BACKUP_TZ;

    const missing: string[] = [];
    if (!project_name) missing.push("project_name");
    if (!report_date) missing.push("report_date");
    if (!content) missing.push("content");

    if (missing.length > 0) {
      return new Response(
        JSON.stringify({ error: `Missing required fields: ${missing.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Resolve user_id from JWT
    const resolved = await resolveUserId(req, supabaseUrl, anonKey, supabase);
    if (resolved.error) return resolved.error;
    const user_id = resolved.user_id;

    // Look up daily_reports row to get log_ids for Backup Log
    const { data: dailyRows } = await supabase
      .from("daily_reports")
      .select("id, log_ids, created_at")
      .eq("user_id", user_id)
      .eq("report_date", report_date)
      .eq("project_name", project_name)
      .order("created_at", { ascending: false });

    let voiceLogs: VoiceLogForBackup[] = [];
    const logIds: string[] = (dailyRows && dailyRows[0]?.log_ids) || [];
    if (logIds.length > 0) {
      const { data: logs, error: logsError } = await supabase
        .from("voice_logs")
        .select("recorded_at, transcript")
        .in("id", logIds);
      if (!logsError && logs) {
        voiceLogs = logs as VoiceLogForBackup[];
      } else if (logsError) {
        console.error("Backup Log voice_logs fetch failed (non-fatal):", logsError);
      }
    }

    // Generate multi-section PDF: report + Backup Log on a fresh page
    const backupLogContent = buildBackupLog(voiceLogs, timezone);
    const pdfBytes = generatePdfBytes([
      { content },
      { content: backupLogContent },
    ]);

    const sanitizedName = project_name.replace(/[^a-zA-Z0-9 \-]/g, "").trim().replace(/\s+/g, " ");
    const pdfPath = `${report_date}/${sanitizedName}_Daily Report_${report_date}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("report-pdfs")
      .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });

    if (uploadError) {
      console.error("PDF upload failed:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload PDF" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pdfUrl = `${supabaseUrl}/storage/v1/object/public/report-pdfs/${pdfPath}`;

    let updatedDailyReport = false;
    if (dailyRows && dailyRows.length > 0) {
      await supabase
        .from("daily_reports")
        .update({ content, pdf_url: pdfUrl })
        .eq("id", dailyRows[0].id);
      updatedDailyReport = true;
    }

    const { data: adminRows } = await supabase
      .from("admin_reports")
      .select("id, status, created_at")
      .eq("user_id", user_id)
      .eq("report_date", report_date)
      .eq("project_name", project_name)
      .order("created_at", { ascending: false });

    let updatedAdminReport = false;
    if (adminRows && adminRows.length > 0) {
      const updateData: Record<string, string> = { pdf_url: pdfUrl };
      if (adminRows[0].status !== "sent") {
        updateData.status = "pending_sent";
      }
      await supabase.from("admin_reports").update(updateData).eq("id", adminRows[0].id);
      updatedAdminReport = true;
    }

    return new Response(
      JSON.stringify({ pdf_url: pdfUrl, updated_daily_report: updatedDailyReport, updated_admin_report: updatedAdminReport }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("regenerate-report-pdf error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
