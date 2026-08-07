"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { useRouter, usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";

type AuthContextType = {
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  tourSeen: boolean;
  markTourSeen: () => Promise<void>;
  resetTour: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  isLoading: true,
  isAdmin: false,
  tourSeen: false,
  markTourSeen: async () => {},
  resetTour: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tourSeen, setTourSeen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        setTourSeen(false);
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setIsAdmin(false);
        setTourSeen(false);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      setIsLoading(true);
      apiFetch("/auth/profile")
        .then((profile) => {
          setIsAdmin(profile.is_admin === true);
          setTourSeen(profile.tour_seen === true);
        })
        .catch((err) => {
          console.error("Failed to fetch user profile:", err);
          setIsAdmin(false);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsAdmin(false);
    }
  }, [session]);

  const markTourSeen = async () => {
    try {
      await apiFetch("/auth/tour-seen", { method: "POST" });
      setTourSeen(true);
    } catch (err) {
      console.error("Failed to mark tour as seen:", err);
    }
  };

  const resetTour = async () => {
    try {
      await apiFetch("/auth/tour-reset", { method: "POST" });
      setTourSeen(false);
    } catch (err) {
      console.error("Failed to reset tour:", err);
    }
  };

  useEffect(() => {
    if (!isLoading) {
      if (!session && pathname !== "/login") {
        router.push("/login");
      } else if (session && pathname === "/login") {
        router.push("/");
      }
    }
  }, [session, isLoading, pathname, router]);

  return (
    <AuthContext.Provider value={{ session, isLoading, isAdmin, tourSeen, markTourSeen, resetTour }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
