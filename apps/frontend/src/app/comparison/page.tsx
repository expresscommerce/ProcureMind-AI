"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ComparisonTable, ComparisonFeature, ComparisonVendor } from "@/components/ComparisonTable";
import { DocumentUploader } from "@/components/DocumentUploader";
import { ResultsWrapper } from "@/components/ResultsWrapper";
import { ContractTimeline } from "@/components/ContractTimeline";
import { useViewMode } from "@/lib/viewMode";
import { GlossaryTerm } from "@/components/GlossaryTerm";

type Tab = "matrix" | "timeline";

export default function ComparisonMatrixPage() {
  const [activeTab, setActiveTab] = useState<Tab>("matrix");
  const { mode } = useViewMode();

  return (
    <ResultsWrapper>
      {(results) => {
        // Compute features dynamically based on vendors if possible, or use standard features
        const FEATURES: ComparisonFeature[] = [
          { name: "Annual Cost", type: "cost" },
          { name: "Data Retention", type: "text" },
          { name: "SLA Uptime", type: "numeric" },
          { name: "Compliance Risk", type: "risk" },
          { name: "SSO Support", type: "text" },
        ];

        // Map vendors from backend results
        const resultVendors = results?.structured_proposal?.vendors || [];
        const VENDORS: ComparisonVendor[] = resultVendors.map((v: any) => ({
          id: v.id,
          name: v.name,
          subtitle: v.category || "",
          values: {
            "Annual Cost": v.annualCost || "-",
            "Data Retention": v.dataRetention || "-",
            "SLA Uptime": v.slaUptime || "-",
            "Compliance Risk": v.complianceRisk || "low",
            "SSO Support": v.ssoSupport || "-",
          }
        }));

        const timelineData = results?.timeline_events || [];

        return (
          <div className="space-y-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-serif text-3xl font-semibold text-ink mb-2">
                  {mode === "simple" ? "Side-by-Side Comparison" : "Comparison Matrix"}
                </h1>
                <p className="text-ink-muted">
                  {mode === "simple"
                    ? "See how your vendor options stack up against each other."
                    : "Compare vendors side-by-side to evaluate alternative options."}
                </p>
              </div>
              <div className="flex gap-3">
                <DocumentUploader variant="secondary" label="Add Vendor" />
                <Button disabled title="Exporting is coming in Phase 4">Export Matrix</Button>
              </div>
            </div>

            {/* Tab switcher */}
            <div className="flex items-center gap-1 border-b border-rule">
              <button
                onClick={() => setActiveTab("matrix")}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === "matrix"
                    ? "border-navy text-navy"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {mode === "simple" ? "Comparison" : "Matrix"}
              </button>
              <button
                onClick={() => setActiveTab("timeline")}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === "timeline"
                    ? "border-navy text-navy"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                Timeline
              </button>
            </div>

            {/* Tab content */}
            {activeTab === "matrix" && (
              <div>
                {mode === "simple" && VENDORS.length > 0 && (
                  <div className="mb-4 text-sm text-ink-muted">
                    This table compares your vendors across key criteria. Values highlighted in red indicate higher risk.
                  </div>
                )}
                <ComparisonTable features={FEATURES} vendors={VENDORS} />
              </div>
            )}

            {activeTab === "timeline" && (
              <div>
                <div className="mb-4">
                  <h2 className="font-serif text-xl font-semibold text-ink mb-1">
                    Contract Timeline
                  </h2>
                  <p className="text-sm text-ink-muted">
                    {mode === "simple"
                      ? "Key dates and deadlines across your vendor contracts. Red dots are risks; green dots are things that protect you."
                      : "Visual timeline of contract milestones, renewal windows, and time-sensitive risk events per vendor."}
                  </p>
                </div>
                <ContractTimeline timelineData={timelineData} />
              </div>
            )}
          </div>
        );
      }}
    </ResultsWrapper>
  );
}
