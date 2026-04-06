import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface User {
  id: string;
  email: string;
  project_name: string | null;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [otpSent, setOtpSent] = useState(false);

  // Resolve internal user profile from auth session
  const resolveProfile = useCallback(async (authUser: { id: string; email?: string }) => {
    const email = authUser.email || "";

    // Try by auth_id first
    const { data: byAuth } = await supabase
      .from("users")
      .select("id, email, project_name")
      .eq("auth_id", authUser.id)
      .maybeSingle();

    if (byAuth) {
      setUser({ id: byAuth.id, email: byAuth.email, project_name: byAuth.project_name });
      return;
    }

    // Try by email — bind auth_id
    const { data: byEmail } = await supabase
      .from("users")
      .select("id, email, project_name, auth_id")
      .eq("email", email)
      .maybeSingle();

    if (byEmail && !byEmail.auth_id) {
      // Bind auth_id (uses service role via edge function or RLS allows update on own row)
      // Since RLS requires auth_id match, we need the edge function to have done this.
      // Actually the edge function resolveUserId already handles binding.
      // For now, set user optimistically — the edge function will bind on next call.
      setUser({ id: byEmail.id, email: byEmail.email, project_name: byEmail.project_name });
      return;
    }

    if (byEmail) {
      setUser({ id: byEmail.id, email: byEmail.email, project_name: byEmail.project_name });
      return;
    }

    // No profile exists — create one (RLS won't allow this from client since no auth_id match yet)
    // Use a workaround: insert via the users table with auth_id set
    const { data: newUser, error } = await supabase
      .from("users")
      .insert({ email, auth_id: authUser.id })
      .select("id, email, project_name")
      .single();

    if (error) {
      console.error("Failed to create user profile:", error);
      // Retry select in case of race condition
      const { data: retry } = await supabase
        .from("users")
        .select("id, email, project_name")
        .eq("auth_id", authUser.id)
        .maybeSingle();
      if (retry) {
        setUser({ id: retry.id, email: retry.email, project_name: retry.project_name });
      }
      return;
    }

    if (newUser) {
      setUser({ id: newUser.id, email: newUser.email, project_name: newUser.project_name });
    }
  }, []);

  useEffect(() => {
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          await resolveProfile(session.user);
        } else {
          setUser(null);
        }
        setIsLoading(false);
      }
    );

    // Check existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await resolveProfile(session.user);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [resolveProfile]);

  const login = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw error;
    setOtpSent(true);
  }, []);

  const verifyOtp = useCallback(async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    if (error) throw error;
    setOtpSent(false);
  }, []);

  const updateProjectName = useCallback(async (name: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("users")
      .update({ project_name: name })
      .eq("id", user.id);
    if (!error) {
      setUser((prev) => prev ? { ...prev, project_name: name } : prev);
    }
  }, [user]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("sitelog_onboarding_seen");
    setUser(null);
    setOtpSent(false);
  }, []);

  return { user, login, verifyOtp, logout, updateProjectName, isLoading, otpSent };
}
