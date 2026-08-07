"use client";

import { useProject } from "@/lib/project";

type MobileHeaderProps = {
  isOpen: boolean;
  onMenuClick: () => void;
};

export function MobileHeader({ isOpen, onMenuClick }: MobileHeaderProps) {
  const { currentProject } = useProject();

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 border-b bg-paper flex items-center justify-between gap-2 px-4 py-2 z-30">
      <div className="min-w-0">
        <span className="block font-serif font-semibold text-lg text-ink truncate">ProcureMind AI</span>
        <span className="block text-xs text-ink-muted truncate">{currentProject?.name}</span>
      </div>

      <button
        type="button"
        onClick={onMenuClick}
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={isOpen}
        aria-controls="mobile-sidebar"
        data-tour="nav-overview-mobile"
        className="rounded-sm p-2 text-2xl leading-none shrink-0"
      >
        ☰
      </button>
    </header>
  );
}
