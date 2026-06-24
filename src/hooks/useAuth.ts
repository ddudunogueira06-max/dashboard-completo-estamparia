import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

const MFA_KEY = "mfa_verified_session";

export function markMfaVerified(userId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(MFA_KEY, userId);
}

export function isMfaVerified(userId: string | undefined): boolean {
  if (typeof window === "undefined") return false;
  if (!userId) return false;
  return sessionStorage.getItem(MFA_KEY) === userId;
}

export function clearMfa() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(MFA_KEY);
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"admin" | "viewer" | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaVerified, setMfaVerified] = useState(false);

  useEffect(() => {
    let mounted = true;

    const refreshRole = async (uid: string | undefined) => {
      if (!uid) {
        setRole(null);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      if (!mounted) return;
      const roles = (data ?? []).map((r) => r.role);
      setRole(roles.includes("admin") ? "admin" : "viewer");
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setMfaVerified(isMfaVerified(data.session?.user?.id));
      refreshRole(data.session?.user?.id).finally(() => mounted && setLoading(false));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (!mounted) return;
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setSession(sess);
      setUser(sess?.user ?? null);
      setMfaVerified(isMfaVerified(sess?.user?.id));
      if (event === "SIGNED_OUT") {
        clearMfa();
        setRole(null);
      } else {
        refreshRole(sess?.user?.id);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Re-read MFA flag whenever user changes (e.g. after markMfaVerified call)
  useEffect(() => {
    const id = setInterval(() => {
      setMfaVerified(isMfaVerified(user?.id));
    }, 500);
    return () => clearInterval(id);
  }, [user?.id]);

  return { session, user, role, loading, mfaVerified, isAdmin: role === "admin" };
}
