"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

type UserDisplay = {
  avatar: string;
  name: string;
};

function getDisplayName(user: { email?: string; user_metadata?: Record<string, unknown> } | null): UserDisplay {
  const metadata = user?.user_metadata ?? {};
  const penName = typeof metadata.pen_name === "string" ? metadata.pen_name.trim() : "";
  const fallbackName = user?.email?.split("@")[0]?.trim() || "创作者";
  const name = penName || fallbackName;
  const avatar = Array.from(name)[0] || "创";

  return {
    avatar,
    name
  };
}

export function UserBadge() {
  const [display, setDisplay] = useState<UserDisplay>({
    avatar: "创",
    name: "创作者"
  });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setDisplay(getDisplayName(data.user));
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setDisplay(getDisplayName(session?.user ?? null));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <>
      <span className="forge-avatar" aria-hidden="true">
        {display.avatar}
      </span>
      <span className="forge-user-name">{display.name}</span>
    </>
  );
}
