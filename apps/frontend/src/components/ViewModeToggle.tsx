"use client";

import { useViewMode } from "@/lib/viewMode";

export function ViewModeToggle() {
  const { mode, toggleMode, isLoading } = useViewMode();

  if (isLoading) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
        View
      </span>
      <button
        onClick={toggleMode}
        className="relative flex items-center h-7 w-[120px] rounded-sm border border-rule bg-paper overflow-hidden transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
        aria-label={`Switch to ${mode === "simple" ? "expert" : "simple"} mode`}
      >
        {/* Sliding indicator */}
        <div
          className="absolute top-0 h-full w-1/2 bg-navy rounded-sm transition-transform duration-200 ease-out"
          style={{
            transform: mode === "expert" ? "translateX(100%)" : "translateX(0%)",
          }}
        />
        <span
          className={`relative z-10 flex-1 text-center text-xs font-medium transition-colors duration-200 ${
            mode === "simple" ? "text-surface" : "text-ink-muted"
          }`}
        >
          Simple
        </span>
        <span
          className={`relative z-10 flex-1 text-center text-xs font-medium transition-colors duration-200 ${
            mode === "expert" ? "text-surface" : "text-ink-muted"
          }`}
        >
          Expert
        </span>
      </button>
    </div>
  );
}
