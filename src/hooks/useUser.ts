import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface User {
  id: string;
  email: string;
  project_name: string | null;
}

const STORAGE_KEY = "sitelog_user_id";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedId = localStorage.getItem(STORAGE_KEY);
    if (!storedId) {
      setIsLoading(false);
      return;
    }

    supabase
      .from("users")
      .select("id, email, project_name")
      .eq("id", storedId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          localStorage.removeItem(STORAGE_KEY);
        } else {
          setUser({ id: data.id, email: data.email, project_name: data.project_name });
        }
        setIsLoading(false);
      });
  }, []);

  const login = useCallback(async (email: string) => {
    // Try insert (ignore conflict), then select
    await supabase.from("users").insert({ email }).select().maybeSingle();

    const { data, error } = await supabase
      .from("users")
      .select("id, email, project_name")
      .eq("email", email)
      .single();

    if (error || !data) throw new Error("Failed to create user");

    localStorage.setItem(STORAGE_KEY, data.id);
    setUser({ id: data.id, email: data.email, project_name: data.project_name });
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

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("sitelog_onboarding_seen");
    setUser(null);
  }, []);

  return { user, login, logout, updateProjectName, isLoading };
}
