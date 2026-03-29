import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface User {
  id: string;
  email: string;
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
      .select("id, email")
      .eq("id", storedId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          localStorage.removeItem(STORAGE_KEY);
        } else {
          setUser({ id: data.id, email: data.email });
        }
        setIsLoading(false);
      });
  }, []);

  const login = useCallback(async (email: string) => {
    // Try insert (ignore conflict), then select
    await supabase.from("users").insert({ email }).select().maybeSingle();

    const { data, error } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", email)
      .single();

    if (error || !data) throw new Error("Failed to create user");

    localStorage.setItem(STORAGE_KEY, data.id);
    setUser({ id: data.id, email: data.email });
  }, []);

  return { user, login, isLoading };
}
