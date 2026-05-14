import {
  Activity,
  BarChart3,
  BrainCircuit,
  Database,
  GitCompareArrows,
  Layers3,
  Settings,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

const navItems = [
  { href: "/runs", label: "Runs", icon: BarChart3 },
  { href: "/runs/new", label: "Import", icon: Upload },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
  { href: "/combos", label: "Combos", icon: Layers3 },
  { href: "/analysis", label: "Analysis", icon: BrainCircuit },
  { href: "/market-data", label: "Market data", icon: Database },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="app-shell min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="side-rail p-4 lg:sticky lg:top-0 lg:h-screen">
        <Link className="mb-8 flex items-center gap-3" href="/runs">
          <span className="brand-mark grid size-10 place-items-center rounded-md">
            <Activity aria-hidden size={20} />
          </span>
          <span>
            <span className="brand-title block font-bold">
              Strategy Tracker
            </span>
            <span className="quiet-text text-xs uppercase">
              Research console
            </span>
          </span>
        </Link>
        <nav className="grid gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link className="nav-link" href={item.href} key={item.href}>
                <Icon aria-hidden size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
