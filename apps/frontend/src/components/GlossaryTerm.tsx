"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import glossaryData from "@/lib/glossary.json";

interface GlossaryTermProps {
  term: string;
  children?: React.ReactNode;
}

const glossaryMap = new Map(
  glossaryData.map((entry) => [entry.term.toLowerCase(), entry.definition])
);

export function GlossaryTerm({ term, children }: GlossaryTermProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0, pointerEvents: "none" });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popoverElementRef = useRef<HTMLDivElement | null>(null);

  const definition = glossaryMap.get(term.toLowerCase());

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use callback ref to measure popover immediately when it mounts
  const popoverRef = useCallback((node: HTMLDivElement | null) => {
    popoverElementRef.current = node;
    if (node !== null && triggerRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const popoverRect = node.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Determine vertical positioning (above or below)
      const spaceBelow = viewportHeight - triggerRect.bottom;
      const verticalPos = spaceBelow < popoverRect.height + 15 ? "above" : "below";

      // Keep it within screen boundaries horizontally (10px padding)
      let left = triggerRect.left + triggerRect.width / 2 - popoverRect.width / 2;
      const minLeft = 10;
      const maxLeft = viewportWidth - popoverRect.width - 10;

      if (left < minLeft) {
        left = minLeft;
      } else if (left > maxLeft) {
        left = maxLeft;
      }

      // Position fixed relative to viewport
      const topPos = verticalPos === "below" 
        ? triggerRect.bottom + 6 
        : triggerRect.top - popoverRect.height - 6;

      setStyle({
        position: "fixed",
        left: `${left}px`,
        top: `${topPos}px`,
        opacity: 1,
        pointerEvents: "auto",
        zIndex: 99999, // Ensure it sits on top of all tables, drawers, and modal containers
      });
    }
  }, []);

  // Close on click outside or scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (
        popoverElementRef.current &&
        !popoverElementRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      // Close tooltip on viewport or window scroll to prevent floating detached
      setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClick);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  // When isOpen changes to false, clean style state
  useEffect(() => {
    if (!isOpen) {
      setStyle({ opacity: 0, pointerEvents: "none" });
    }
  }, [isOpen]);

  if (!definition) {
    // Term not in glossary — render as plain text
    return <>{children || term}</>;
  }

  return (
    <span className="relative inline">
      <span
        ref={triggerRef}
        className="border-b border-dotted border-ink-muted/60 cursor-help transition-colors hover:border-navy hover:text-navy"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        tabIndex={0}
        aria-label={`Definition of ${term}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
      >
        {children || term}
      </span>

      {isOpen && mounted && createPortal(
        <div
          ref={popoverRef}
          style={style}
          className="w-72 max-w-[85vw] whitespace-normal break-words px-3 py-2.5 text-sm leading-relaxed bg-surface border border-rule rounded-md shadow-md text-ink transition-opacity duration-150"
          role="tooltip"
        >
          <span className="font-medium text-navy text-xs uppercase tracking-wider block mb-1">
            {term}
          </span>
          <span className="text-ink-muted">{definition}</span>
        </div>,
        document.body
      )}
    </span>
  );
}
