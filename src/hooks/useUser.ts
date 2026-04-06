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

    const { data: byAuth } = await supabase
      .from("users")
      .select("id, email, project_name")
      .eq("auth_id", authUser.id)
      .maybeSingle();

    if (byAuth) {
      setUser({ id: byAuth.id, email: byAuth.email, project_name: byAuth.project_name });
      return;
    }

    const { data: byEmail } = await supabase
      .from("users")
      .select("id, email, project_name, auth_id")
      .eq("email", email)
      .maybeSingle();

    if (byEmail) {
      setUser({ id: byEmail.id, email: byEmail.email, project_name: byEmail.project_name });
      return;
    }

    const { data: newUser, error } = await supabase
      .from("users")
      .insert({ email, auth_id: authUser.id })
      .select("id, email, project_name")
      .single();

    if (error) {
      console.error("Failed to create user profile:", error);
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
