"use client";

import React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ComparisonTable, ComparisonFeature, ComparisonVendor } from "@/components/ComparisonTable";
import { DocumentUploader } from "@/components/DocumentUploader";
import { ResultsWrapper } from "@/components/ResultsWrapper";
import { ContractTimeline } from "@/components/ContractTimeline";
import { useViewMode } from "@/lib/viewMode";
import { GlossaryTerm } from "@/components/GlossaryTerm";
import { PipelineRunner } from "@/components/PipelineRunner";
import { CSVLink } from "react-csv";

type Tab = "matrix" | "timeline";

export default function ComparisonMatrixPage() {
  const [activeTab, setActiveTab] = useState<Tab>("matrix");
  const { mode } = useViewMode();

  const data = [
    { name: "Vendor 1", "Annual Cost": "$10,000", "Data Retention": "5 years", "SLA Uptime": "99.9%", "Compliance Risk": "low", "SSO Support": "Yes" },
    { name: "Vendor 2", "Annual Cost": "$15,000", "Data Retention": "10 years", "SLA Uptime": "99.5%", "Compliance Risk": "medium", "SSO Support": "Yes" },
    { name: "Vendor 3", "Annual Cost": "$20,000", "Data Retention": "15 years", "SLA Uptime": "99.0%", "Compliance Risk": "high", "SSO Support": "No" }
  ]

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

        const data = resultVendors.map((v: any) => ({
          Name: v.name,
          Subtitle: v.category || "",
          "Annual Cost": v.annualCost || "-",
          "Data Retention": v.dataRetention || "-",
          "SLA Uptime": v.slaUptime || "-",
          "Compliance Risk": v.complianceRisk || "low",
          "SSO Support": v.ssoSupport || "-",
        }));
        
        const isDisabled = VENDORS.length === 0;

        const handleCsvClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
          if (isDisabled) {
            event.preventDefault();
            return false;
          }
        }

        const timelineData = results?.timeline_events || [];

        return (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
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
              <div className="flex flex-wrap gap-3 shrink-0">
                <DocumentUploader variant="secondary" label="Add Vendor" />
                <PipelineRunner />
                <CSVLink onClick={handleCsvClick} data={data} filename="comparison_matrix.csv">
                  <Button disabled={isDisabled} >Export Matrix</Button>
                </CSVLink>
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
