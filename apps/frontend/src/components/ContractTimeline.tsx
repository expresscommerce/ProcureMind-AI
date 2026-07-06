"use client";

import { useState } from "react";
import { useViewMode } from "@/lib/viewMode";

interface TimelineEvent {
  date: string;
  label: string;
  type: "positive" | "negative";
  plain_language: string;
  source_page?: string;
}

interface VendorTimeline {
  vendor_name: string;
  contract_start: string;
  contract_end: string;
  events: TimelineEvent[];
}

interface ContractTimelineProps {
  timelineData: VendorTimeline[];
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function getPositionPercent(
  dateStr: string,
  startStr: string,
  endStr: string
): number {
  const date = new Date(dateStr).getTime();
  const start = new Date(startStr).getTime();
  const end = new Date(endStr).getTime();
  if (end <= start) return 0;
  const pct = ((date - start) / (end - start)) * 100;
  return Math.max(0, Math.min(100, pct));
}

export function ContractTimeline({ timelineData }: ContractTimelineProps) {
  const { mode } = useViewMode();
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  if (!timelineData || timelineData.length === 0) {
    return (
      <div className="text-sm text-ink-muted py-4">
        No timeline data available. Run the analysis pipeline to generate
        contract timelines.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {timelineData.map((vendor) => (
        <div key={vendor.vendor_name} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg font-semibold text-ink">
              {vendor.vendor_name}
            </h3>
            <div className="flex items-center gap-4 text-xs text-ink-muted font-mono">
              <span>{formatDate(vendor.contract_start)}</span>
              <span className="text-rule">→</span>
              <span>{formatDate(vendor.contract_end)}</span>
            </div>
          </div>

          {/* Timeline bar */}
          <div className="relative">
            {/* Main timeline line */}
            <div className="h-px bg-navy w-full relative">
              {/* Start and end markers */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-navy" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-navy" />

              {/* Event markers */}
              {vendor.events.map((event, i) => {
                const left = getPositionPercent(
                  event.date,
                  vendor.contract_start,
                  vendor.contract_end
                );
                const eventId = `${vendor.vendor_name}-${i}`;
                const isExpanded = expandedEvent === eventId;

                return (
                  <div
                    key={i}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                    style={{ left: `${left}%` }}
                  >
                    <button
                      className={`w-3 h-3 rounded-full border-2 transition-all hover:scale-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy ${
                        event.type === "negative"
                          ? "bg-audit-red border-audit-red"
                          : "bg-verdigris border-verdigris"
                      }`}
                      onClick={() =>
                        setExpandedEvent(isExpanded ? null : eventId)
                      }
                      aria-label={`${event.label} — ${event.date}`}
                    />

                    {/* Date label below marker */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <span className="text-[10px] font-mono text-ink-muted">
                        {formatDate(event.date)}
                      </span>
                    </div>

                    {/* Expanded card */}
                    {isExpanded && (
                      <div className="absolute top-8 left-1/2 -translate-x-1/2 w-72 bg-surface border border-rule rounded-md shadow-md p-3 z-20 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            className={`text-xs font-semibold uppercase tracking-wider ${
                              event.type === "negative"
                                ? "text-audit-red"
                                : "text-verdigris"
                            }`}
                          >
                            {event.label}
                          </span>
                          <span className="text-xs font-mono text-ink-muted">
                            {event.date}
                          </span>
                        </div>
                        <p className="text-sm text-ink leading-relaxed">
                          {event.plain_language}
                        </p>
                        {event.source_page && (
                          <div className="mt-2 text-xs text-ink-muted font-mono">
                            Source: p. {event.source_page}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Spacer for date labels */}
            <div className="h-8" />
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-ink-muted">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-audit-red" />
              <span>Risk event</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-verdigris" />
              <span>Buyer-positive event</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
