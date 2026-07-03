import React from "react";
import { cn } from "@/lib/utils";

interface HiddenCostAnnotationProps {
  statedPrice: string;
  correctedPrice: string;
  className?: string;
}

export function HiddenCostAnnotation({
  statedPrice,
  correctedPrice,
  className,
}: HiddenCostAnnotationProps) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span className="tabular-nums text-ink line-through decoration-audit-red decoration-1">
        {statedPrice}
      </span>
      <div className="relative flex items-center text-audit-red">
        <svg
          width="12"
          height="24"
          viewBox="0 0 12 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mr-1 opacity-80"
        >
          <path
            d="M1 1C1 1 10 5.5 10 12C10 18.5 1 23 1 23"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <span
          className="tabular-nums font-medium"
          style={{ fontFamily: "'Caveat', 'Segoe Print', cursive", fontSize: "1.1em", transform: "rotate(-2deg)" }}
        >
          {correctedPrice}
        </span>
      </div>
    </div>
  );
}
