"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Page() {
  const [ready, setReady] = useState(false);
  const [debug, setDebug] = useState("start");

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        setDebug("before getSession");

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        setDebug(`after getSession: ${session ? "session yes" : "session no"}`);

        if (session?.user) {
          setDebug("before profile query");

          const { data, error } = await supabase
            .from("profiles")
            .select("id, login, email")
            .eq("id", session.user.id)
            .maybeSingle();

          if (!mounted) return;

          if (error) {
            console.error("PROFILE ERROR:", error);
            setDebug(`profile error: ${error.message}`);
          } else if (!data) {
            setDebug("profile not found");
          } else {
            setDebug(`profile ok: ${data.login}`);
          }
        }
      } catch (error) {
        console.error("BOOTSTRAP ERROR:", error);
        if (mounted) setDebug("bootstrap error");
      } finally {
        if (mounted) setReady(true);
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white text-2xl">
        Ładowanie... {debug}
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white text-2xl">
      GOTOWE: {debug}
    </main>
  );
}
