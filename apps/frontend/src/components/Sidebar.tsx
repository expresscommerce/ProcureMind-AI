"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Settings, LogOut } from "lucide-react";
import { Button } from "./ui/button";

const PROFILE_MENU_WIDTH = 200;
const PROFILE_MENU_HEIGHT = 116;

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
  }
];

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};


export function Sidebar({
  isOpen,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();
  const { isAdmin, session } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [profileMenuPos, setProfileMenuPos] = useState<{ top: number; left: number } | null>(null);
  const profileBtnRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);


  const userEmail = session?.user?.email;
  const initial = userEmail?.[0]?.toUpperCase() ?? "?";

  useEffect(() => {
    if (!profileOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileBtnRef.current?.contains(target)) return;
      if (profileMenuRef.current?.contains(target)) return;
      setProfileOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen]);


  return (
    <>
      <aside
        id="mobile-sidebar"
        aria-label="Sidebar navigation"
        className={cn(
          "fixed inset-y-0 left-0 w-[240px] bg-paper border-r border-rule flex flex-col z-20 transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0"
        )}
      >
        <div className="p-4 border-b border-rule">
          <span className="block font-serif font-semibold text-xl text-ink truncate">ProcureMind AI</span>
          <div className="mt-1">
            <ProjectSwitcher />
          </div>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-6 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              <h3 className="px-3 text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">
                {group.title}
              </h3>
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const tourAttr = item.href === "/" ? "nav-overview"
                  : item.href === "/documents" ? "nav-documents"
                    : item.href === "/vendors" ? "nav-vendors"
                      : item.href === "/comparison" ? "nav-comparison"
                        : item.href === "/cost" ? "nav-cost"
                          : item.href === "/risk" ? "nav-risk"
                            : item.href === "/compliance" ? "nav-compliance"
                              : item.href === "/sla" ? "nav-sla"
                                : item.href === "/summary" ? "nav-summary"
                                  : item.href === "/outcomes" ? "nav-outcomes"
                                    : undefined;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    data-tour={tourAttr}
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
                onClick={onClose}
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
            onClick={() => {
              onClose();
              window.dispatchEvent(new CustomEvent("open-ask-drawer"));
            }}
            data-tour="ask-question"
            className="text-left px-3 py-2 text-sm font-medium text-navy hover:bg-navy/5 rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-navy"
          >
            Ask a Question
          </button>
          <button
            ref={profileBtnRef}
            onClick={() => {
              if (profileBtnRef.current) {
                const rect = profileBtnRef.current.getBoundingClientRect();
                setProfileMenuPos({
                  top: Math.max(8, rect.top - PROFILE_MENU_HEIGHT - 4),
                  left: Math.max(
                    8,
                    Math.min(rect.left, window.innerWidth - PROFILE_MENU_WIDTH - 8)
                  ),
                });
              }
              setProfileOpen((prev) => !prev);
            }}
            aria-expanded={profileOpen}
            aria-label="Profile"
            title={userEmail}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-semibold text-paper outline-none focus-visible:outline-2 focus-visible:outline-navy focus-visible:outline-offset-2 hover:opacity-90 mt-2"
          >
            {initial}
          </button>

          {profileOpen &&
            profileMenuPos &&
            createPortal(
              <div
                ref={profileMenuRef}
                className="fixed z-50 bg-surface border border-rule rounded-md shadow-xl py-1"
                style={{ top: profileMenuPos.top, left: profileMenuPos.left, width: PROFILE_MENU_WIDTH }}
              >
                <div className="group relative max-w-full cursor-pointer">
                  {/* Truncated Email Display */}
                  <p className="px-3 py-2 text-sm text-gray-500 truncate w-48 text-center">
                    {userEmail}
                  </p>

                  {/* Floating Full Email Tooltip */}
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none 
                    opacity-0 group-hover:opacity-100 transition-opacity duration-200 
                    bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 shadow-md">
                    {userEmail}
                  </span>
                </div>
                <Link
                  href="/settings"
                  onClick={() => {
                    onClose();
                    setProfileOpen(false);
                  }}
                  className="block px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink hover:bg-rule/30 rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-navy"
                >
                  <Settings className="size-4 mr-2 inline-block" />
                  Settings
                </Link>
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    setConfirmSignOut(true);
                  }}
                  className="w-full text-left px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink hover:bg-rule/30 rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-navy"
                >
                  <LogOut className="size-4 mr-2 inline-block" />
                  Sign Out
                </button>
              </div>,
              document.body
            )}

          <div className="px-3 text-xs text-ink-muted mt-2">
            Audit Ledger v1.0
          </div>
        </div>
      </aside>

      {confirmSignOut &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm">
            <div className="bg-surface border border-rule rounded-md p-6 w-[400px] max-w-[90vw] shadow-lg">
              <h2 className="font-serif text-2xl text-ink font-semibold mb-4">Sign out?</h2>
              <p className="text-sm text-ink mb-6">
                Are you sure you want to sign out of your account?
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" type="button" onClick={() => setConfirmSignOut(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  type="button"
                  onClick={async () => {
                    setConfirmSignOut(false);
                    onClose();
                    await supabase.auth.signOut();
                  }}
                >
                  Sign Out
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
