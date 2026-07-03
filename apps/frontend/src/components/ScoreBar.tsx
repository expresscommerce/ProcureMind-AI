import React from "react";
import { cn } from "@/lib/utils";

interface ScoreBarProps {
  score: number; // 0-100
  label?: string;
  className?: string;
}

export function ScoreBar({ score, label, className }: ScoreBarProps) {
  let colorClass = "bg-verdigris";
  if (score < 50) colorClass = "bg-risk-high";
  else if (score < 80) colorClass = "bg-risk-medium";

  return (
    <div className={cn("flex items-center gap-4", className)}>
      {label && <span className="w-24 text-sm font-medium text-ink">{label}</span>}
      <div className="flex-1 h-1.5 bg-rule overflow-hidden rounded-sm">
        <div 
          className={cn("h-full transition-all duration-500", colorClass)} 
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="tabular-nums font-mono text-sm font-medium text-ink w-8 text-right">
        {score}
      </span>
    </div>
  );
}
