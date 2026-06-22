"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/auth/sign-in");
    router.refresh();
  }

  return (
    <button className="forge-exit" disabled={isSigningOut} onClick={handleSignOut} type="button">
      ↪ {isSigningOut ? "退出中" : "退出"}
    </button>
  );
}
