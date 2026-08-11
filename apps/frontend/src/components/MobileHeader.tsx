"use client";

import { ProjectSwitcher } from "./ProjectSwitcher";

type MobileHeaderProps = {
  isOpen: boolean;
  onMenuClick: () => void;
};

export function MobileHeader({ isOpen, onMenuClick }: MobileHeaderProps) {
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-30 border-b bg-paper">
      <div className="flex items-center justify-between gap-2 px-4 pt-2">
        <span className="font-serif font-semibold text-lg text-ink truncate">ProcureMind AI</span>

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
      </div>

      <div className="px-4 pb-2">
        <div className="max-w-[240px]">
          <ProjectSwitcher />
        </div>
      </div>
    </header>
  );
}
