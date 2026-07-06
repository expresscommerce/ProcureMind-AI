"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

const NAV_GROUPS = [
  {
    title: "1. Workspace",
    items: [
      { name: "Overview", href: "/" },
      { name: "Vendor Documents", href: "/documents" },
      { name: "Vendor Directory", href: "/vendors" },
    ]
  },
  {
    title: "2. Analysis",
    items: [
      { name: "Comparison Matrix", href: "/comparison" },
      { name: "Cost Analysis", href: "/cost" },
      { name: "Risk Assessment", href: "/risk" },
      { name: "Compliance", href: "/compliance" },
      { name: "SLA Tracker", href: "/sla" },
    ]
  },
  {
    title: "3. Reporting & Feedback",
    items: [
      { name: "Executive Summary", href: "/summary" },
      { name: "Log Outcomes", href: "/outcomes" },
    ]
  },
  {
    title: "Configuration",
    items: [
      { name: "Settings", href: "/settings" },
    ]
  }
];

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  return (
    <aside className="w-[240px] fixed inset-y-0 left-0 bg-paper border-r border-rule flex flex-col z-20">
      <div className="p-6 h-16 flex items-center border-b border-rule">
        <span className="font-serif font-semibold text-xl text-ink">ProcureMind AI</span>
      </div>
      <nav className="flex-1 py-6 px-4 space-y-6 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="space-y-1">
            <h3 className="px-3 text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">
              {group.title}
            </h3>
            {group.items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block px-3 py-2 text-sm font-medium rounded-sm transition-colors outline-none focus-visible:outline-2 focus-visible:outline-navy focus-visible:-outline-offset-2",
                    isActive 
                      ? "bg-navy/5 text-navy" 
                      : "text-ink-muted hover:text-ink hover:bg-rule/30"
                  )}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
        ))}

        {/* Admin section - shown below a divider, unnumbered */}
        {isAdmin && (
          <div className="pt-4 border-t border-rule mt-4 space-y-1">
            <h3 className="px-3 text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">
              System Administration
            </h3>
            <Link
              href="/admin/ml-control-center"
              className={cn(
                "block px-3 py-2 text-sm font-medium rounded-sm transition-colors outline-none focus-visible:outline-2 focus-visible:outline-navy focus-visible:-outline-offset-2",
                pathname === "/admin/ml-control-center"
                  ? "bg-navy/5 text-navy font-semibold"
                  : "text-ink-muted hover:text-ink hover:bg-rule/30"
              )}
            >
              ML Control Center
            </Link>
          </div>
        )}
      </nav>
      <div className="p-4 border-t border-rule flex flex-col gap-2">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-ask-drawer"))}
          className="text-left px-3 py-2 text-sm font-medium text-navy hover:bg-navy/5 rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-navy"
        >
          Ask a Question
        </button>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
          }}
          className="text-left px-3 py-1 text-sm font-medium text-ink-muted hover:text-ink hover:bg-rule/30 rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-navy mt-2"
        >
          Sign Out
        </button>
        <div className="px-3 text-xs text-ink-muted mt-2">
          Audit Ledger v1.0
        </div>
      </div>
    </aside>
  );
}
