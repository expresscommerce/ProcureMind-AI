"use client";

type MobileHeaderProps = {
  isOpen: boolean;
  onMenuClick: () => void;
};

export function MobileHeader({ isOpen, onMenuClick }: MobileHeaderProps) {
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 h-16 border-b bg-paper flex items-center justify-between px-4 z-30">
      <span className="font-serif font-semibold text-xl text-ink">ProcureMind AI</span>

      <button
        type="button"
        onClick={onMenuClick}
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={isOpen}
        aria-controls="mobile-sidebar"
        className="rounded-sm p-2 text-2xl leading-none"
      >
        ☰
      </button>
    </header>
  );
}