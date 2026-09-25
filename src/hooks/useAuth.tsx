import { useState, useEffect, useRef, createContext, useContext } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);
  const loading = authLoading || roleLoading;
  const [isAdmin, setIsAdmin] = useState(false);
  // Last user id whose role was loaded; token refreshes for the same user must not reset loading.
  const roleUserId = useRef<string | null>(null);

  useEffect(() => {
    const fetchAdminRole = async (userId: string) => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (roleUserId.current !== userId) return; // user changed meanwhile
      if (error) console.error("Failed to load user role:", error);
      setIsAdmin(!error && !!data);
      setRoleLoading(false);
    };

    const handleSession = (session: Session | null, deferred: boolean) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      const uid = session?.user?.id ?? null;
      if (uid === roleUserId.current) {
        if (!uid) setRoleLoading(false);
        return; // same user (e.g. TOKEN_REFRESHED) — keep current role state
      }
      roleUserId.current = uid;
      if (uid) {
        setRoleLoading(true);
        // Defer to avoid deadlocks inside the auth callback
        if (deferred) setTimeout(() => void fetchAdminRole(uid), 0);
        else void fetchAdminRole(uid);
      } else {
        setIsAdmin(false);
        setRoleLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session, true);
    });

    supabase.auth.getSession().then(({ data: { session } }) => handleSession(session, false));

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = { user, session, loading, isAdmin, signOut };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
