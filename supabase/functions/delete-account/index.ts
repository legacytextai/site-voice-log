import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.4/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const jwt = authHeader.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Verify the caller's identity using the anon client
  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: { user: authUser }, error: userError } = await anonClient.auth.getUser(jwt);
  if (userError || !authUser) {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authUid = authUser.id;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Resolve the internal user profile
    const { data: profile, error: profileError } = await adminClient
      .from("users")
      .select("id, email")
      .eq("auth_id", authUid)
      .maybeSingle();

    if (profileError) throw new Error(`Profile lookup failed: ${profileError.message}`);
    if (!profile) {
      // No profile found — just delete the auth user
      await adminClient.auth.admin.deleteUser(authUid);
      return new Response(JSON.stringify({ success: true, message: "Auth user deleted (no profile found)" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = profile.id;
    const userEmail = profile.email;

    // 2. Delete voice_logs
    const { error: logsErr } = await adminClient
      .from("voice_logs")
      .delete()
      .eq("user_id", userId);
    if (logsErr) console.error("voice_logs delete error:", logsErr.message);

    // 3. Delete daily_reports
    const { error: reportsErr } = await adminClient
      .from("daily_reports")
      .delete()
      .eq("user_id", userId);
    if (reportsErr) console.error("daily_reports delete error:", reportsErr.message);

    // 4. Delete admin_reports
    const { error: adminReportsErr } = await adminClient
      .from("admin_reports")
      .delete()
      .eq("user_id", userId);
    if (adminReportsErr) console.error("admin_reports delete error:", adminReportsErr.message);

    // 5. Delete storage files (recordings, transcripts, report-pdfs)
    // Files are stored as YYYY-MM-DD/{user-email}/...
    const buckets = ["recordings", "transcripts", "report-pdfs"];
    for (const bucket of buckets) {
      try {
        // List all folders/files containing the user email
        // We need to search across date folders, so list top-level first
        const { data: dateFolders } = await adminClient.storage
          .from(bucket)
          .list("", { limit: 1000 });

        if (dateFolders) {
          for (const folder of dateFolders) {
            if (!folder.name) continue;
            // List files in YYYY-MM-DD/{userEmail}/
            const { data: userFiles } = await adminClient.storage
              .from(bucket)
              .list(`${folder.name}/${userEmail}`, { limit: 1000 });

            if (userFiles && userFiles.length > 0) {
              const filePaths = userFiles.map(
                (f) => `${folder.name}/${userEmail}/${f.name}`
              );
              await adminClient.storage.from(bucket).remove(filePaths);
            }
          }
        }
      } catch (storageErr) {
        console.error(`Storage cleanup error (${bucket}):`, storageErr);
      }
    }

    // 6. Delete user profile row
    const { error: deleteProfileErr } = await adminClient
      .from("users")
      .delete()
      .eq("id", userId);
    if (deleteProfileErr) console.error("users delete error:", deleteProfileErr.message);

    // 7. Delete the auth user (last step)
    const { error: authDeleteErr } = await adminClient.auth.admin.deleteUser(authUid);
    if (authDeleteErr) throw new Error(`Auth deletion failed: ${authDeleteErr.message}`);

    return new Response(
      JSON.stringify({ success: true, message: "Account and all data deleted" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("delete-account error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
