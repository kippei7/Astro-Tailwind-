import Link from "next/link";
import { CalendarDays, LayoutDashboard, ListChecks, Settings } from "lucide-react";

const NAV = [
  { href: "/", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/tasks", label: "予定", icon: CalendarDays },
  { href: "/masters", label: "タスク定義", icon: ListChecks },
  { href: "/settings", label: "設定", icon: Settings },
];

export function AppShell({
  children,
  currentPath,
}: {
  children: React.ReactNode;
  currentPath: string;
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden>
            ⌂
          </span>
          <span>
            <span className="brand-name">CleanSync</span>
            <span className="brand-sub">掃除の実績を、交渉の材料に</span>
          </span>
        </Link>
        <nav className="side-nav">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? currentPath === "/"
                : currentPath.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "nav-link nav-link-active" : "nav-link"}
              >
                <Icon size={18} strokeWidth={1.8} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <p className="sidebar-note">
          Phase 1 · Web MVP
          <br />
          カレンダー / Alexa は次フェーズ
        </p>
      </aside>
      <div className="main-column">
        <header className="mobile-header">
          <Link href="/" className="brand-name">
            CleanSync
          </Link>
        </header>
        <main className="page-main">{children}</main>
        <nav className="bottom-nav">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? currentPath === "/"
                : currentPath.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "bottom-link bottom-link-active" : "bottom-link"}
              >
                <Icon size={18} strokeWidth={1.8} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
