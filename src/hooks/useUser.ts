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

  const resolveProfile = useCallback(async (authUser: { id: string; email?: string }) => {
    const email = authUser.email || "";
    const { data, error } = await supabase.rpc('get_or_create_user_profile', {
      auth_uid: authUser.id,
      user_email: email,
    });
    if (error || !data || data.length === 0) {
      console.error("Profile resolution failed:", error?.message);
      return;
    }
    const profile = data[0];
    setUser({ id: profile.id, email: profile.email, project_name: profile.project_name });
  }, []);

  useEffect(() => {
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

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await resolveProfile(session.user);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [resolveProfile]);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `https://site-voice-log.lovable.app/reset-password`,
    });
    if (error) throw error;
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
  }, []);

  return { user, signUp, signIn, resetPassword, logout, updateProjectName, isLoading };
}
