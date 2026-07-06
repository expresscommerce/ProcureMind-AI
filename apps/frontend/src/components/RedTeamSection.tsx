"use client";

import { useState } from "react";

interface RedTeamSectionProps {
  redTeam: {
    runner_up_vendor: string;
    runner_up_case: string;
    strongest_point: string;
    recommendation_response: string;
    concedes_point?: boolean;
    areas_where_runner_up_wins?: string[];
  } | null;
  recommendation: {
    recommended_vendor: string;
    recommendation_rationale: string;
    runner_up: string;
  } | null;
}

export function RedTeamSection({
  redTeam,
  recommendation,
}: RedTeamSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (
    !redTeam ||
    !recommendation ||
    !redTeam.runner_up_vendor ||
    !recommendation.recommended_vendor
  ) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Main Recommendation */}
      <div className="border border-rule rounded-md bg-surface p-4 space-y-2">
        <div className="text-xs font-semibold text-verdigris uppercase tracking-wider mb-1">
          Recommended Vendor
        </div>
        <div className="font-serif text-xl font-semibold text-ink">
          {recommendation.recommended_vendor}
        </div>
        <p className="text-sm text-ink-muted leading-relaxed">
          {recommendation.recommendation_rationale}
        </p>
      </div>

      {/* Red-Team Section — collapsed by default */}
      <div className="border border-rule rounded-md bg-surface overflow-hidden">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-paper/50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
        >
          <span className="text-sm font-medium text-ink">
            Why not {redTeam.runner_up_vendor}?
          </span>
          <span className="text-ink-muted text-xs">
            {isExpanded ? "▲ Collapse" : "▼ Expand"}
          </span>
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-rule pt-3 animate-in fade-in duration-200">
            {/* Red-team argument */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-audit-red uppercase tracking-wider">
                Case for {redTeam.runner_up_vendor}
              </span>
              <p className="text-sm text-ink leading-relaxed">
                {redTeam.runner_up_case}
              </p>
            </div>

            {/* Strongest point */}
            {redTeam.strongest_point && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                  Strongest Point
                </span>
                <p className="text-sm text-ink leading-relaxed font-medium">
                  {redTeam.strongest_point}
                </p>
              </div>
            )}

            {/* Areas where runner-up wins */}
            {redTeam.areas_where_runner_up_wins &&
              redTeam.areas_where_runner_up_wins.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {redTeam.areas_where_runner_up_wins.map((area, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 text-xs font-medium bg-paper rounded-sm text-ink-muted border border-rule"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              )}

            {/* Recommendation's response */}
            {redTeam.recommendation_response && (
              <div className="border-t border-rule pt-3 space-y-1.5">
                <span className="text-xs font-semibold text-navy uppercase tracking-wider">
                  {recommendation.recommended_vendor}&apos;s Rebuttal
                </span>
                <p className="text-sm text-ink leading-relaxed">
                  {redTeam.recommendation_response}
                </p>
                {redTeam.concedes_point && (
                  <span className="inline-block text-xs text-risk-medium font-medium">
                    ※ Acknowledges this is a valid consideration
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
