"use client";

import { Button } from "@/components/ui/button";
import { ComparisonTable, ComparisonFeature, ComparisonVendor } from "@/components/ComparisonTable";
import { DocumentUploader } from "@/components/DocumentUploader";
import { ResultsWrapper } from "@/components/ResultsWrapper";

export default function ComparisonMatrixPage() {
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

        return (
          <div className="space-y-8">
            <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink mb-2">Comparison Matrix</h1>
          <p className="text-ink-muted">Compare vendors side-by-side to evaluate alternative options.</p>
        </div>
        <div className="flex gap-3">
          <DocumentUploader variant="secondary" label="Add Vendor" />
          <Button disabled title="Exporting is coming in Phase 4">Export Matrix</Button>
        </div>
      </div>

            <ComparisonTable features={FEATURES} vendors={VENDORS} />
          </div>
        );
      }}
    </ResultsWrapper>
  );
}
