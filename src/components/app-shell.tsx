import Link from "next/link";
import { SignOutButton } from "./sign-out-button";
import { UserBadge } from "./user-badge";

type AppShellProps = {
  active: "write" | "history";
  children: React.ReactNode;
};

export function AppShell({ active, children }: AppShellProps) {
  return (
    <main className="forge-app">
      <header className="forge-topbar">
        <Link className="forge-logo" href="/write">
          <span className="forge-logo-mark">⌁</span>
          <span>Story Forge</span>
        </Link>

        <nav className="forge-nav" aria-label="主导航">
          <Link className={active === "write" ? "forge-tab forge-tab-active" : "forge-tab"} href="/write">
            ✦ 创作
          </Link>
          <Link className={active === "history" ? "forge-tab forge-tab-active" : "forge-tab"} href="/history">
            📚 历史
          </Link>
        </nav>

        <div className="forge-user">
          <UserBadge />
          <SignOutButton />
        </div>
      </header>

      {children}
    </main>
  );
}
