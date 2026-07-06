"use client";

interface InsightCalloutProps {
  insight: {
    found: boolean;
    insight: string;
    explanation: string;
    evidence: string;
  } | null;
}

export function InsightCallout({ insight }: InsightCalloutProps) {
  if (!insight || !insight.found) {
    return null;
  }

  return (
    <div className="border border-rule rounded-md bg-surface p-6 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-navy uppercase tracking-wider">
          Worth noticing
        </span>
      </div>
      <p className="text-sm font-medium text-ink leading-relaxed">
        {insight.insight}
      </p>
      {insight.explanation && (
        <p className="text-sm text-ink-muted leading-relaxed">
          {insight.explanation}
        </p>
      )}
      {insight.evidence && (
        <p className="text-xs text-ink-muted font-mono mt-1">
          Evidence: {insight.evidence}
        </p>
      )}
    </div>
  );
}
