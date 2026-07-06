"use client";

import { ExecutiveSummaryCard } from "@/components/ExecutiveSummaryCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskBadge } from "@/components/RiskBadge";
import { PipelineRunner } from "@/components/PipelineRunner";
import { ResultsWrapper } from "@/components/ResultsWrapper";
import { InsightCallout } from "@/components/InsightCallout";
import { RedTeamSection } from "@/components/RedTeamSection";
import { WeightSimulator } from "@/components/WeightSimulator";
import { useViewMode } from "@/lib/viewMode";
import { PlainLanguageItem, getPlainLanguage } from "@/components/PlainLanguageView";
import { GlossaryTerm } from "@/components/GlossaryTerm";

export default function OverviewPage() {
  const { mode } = useViewMode();

  return (
    <ResultsWrapper>
      {(results) => {
        // Compute summary values from results
        const totalSpend = results?.cost_breakdown?.total_spend || "$0";
        const discrepancies = results?.cost_breakdown?.discrepancies || "$0";
        const vendorsAtRisk = results?.risk_flags?.items?.filter((i: any) => i.financialRisk === "high" || i.securityRisk === "high").length || 0;
        const plainLang = results?.plain_language || {};
        
        // Transform items to alerts for the table
        const alerts: any[] = [];
        if (results?.cost_breakdown?.items) {
          alerts.push(...results.cost_breakdown.items.filter((i: any) => i.hasDiscrepancy).map((i: any) => ({
            id: `cost-${i.id}`, vendor: i.vendor, category: "Cost Discrepancy", severity: "high", details: `Stated: ${i.statedPrice}, Actual: ${i.actualPrice}`,
            plainLanguage: getPlainLanguage(plainLang, i.id, "cost")
          })));
        }
        if (results?.policy_rules?.items) {
          alerts.push(...results.policy_rules.items.filter((i: any) => i.status !== "Compliant").map((i: any) => ({
            id: `policy-${i.id}`, vendor: i.vendor, category: "Compliance", severity: "medium", details: `${i.framework}: ${i.status}`,
            plainLanguage: getPlainLanguage(plainLang, i.id, "compliance")
          })));
        }

        return (
          <div className="space-y-8">
            <div className="flex items-start justify-between relative">
              <div>
                <h1 className="font-serif text-3xl font-semibold text-ink mb-2">Audit Overview</h1>
                <p className="text-ink-muted">
                  {mode === "simple"
                    ? "A clear summary of what we found across your vendor proposals."
                    : "High-level summary of vendor costs, risks, and compliance status."}
                </p>
              </div>
              <PipelineRunner />
            </div>

            {/* Insight callout — top of Overview */}
            <InsightCallout insight={results?.insight} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ExecutiveSummaryCard 
                title={mode === "simple" ? "What You're Spending" : "Total Vendor Spend"}
                value={totalSpend}
                trend={{ value: "-", direction: "up", label: "based on uploads" }}
              />
              <ExecutiveSummaryCard 
                title={mode === "simple" ? "Unexpected Extra Costs" : "Identified Discrepancies"}
                value={discrepancies}
                trend={{ value: "-", direction: "up", label: "found in audit" }}
              />
              <ExecutiveSummaryCard 
                title={mode === "simple" ? "Vendors Needing Attention" : "Vendors at Risk"}
                value={vendorsAtRisk.toString()}
                trend={{ value: "-", direction: "down", label: "requiring review" }}
              />
            </div>

            {/* Recommendation + Red-Team */}
            {results?.recommendation?.recommended_vendor && (
              <RedTeamSection 
                redTeam={results?.red_team}
                recommendation={results?.recommendation}
              />
            )}

            {/* What-if Scoring Simulator */}
            {results?.recommendation?.vendor_scores?.length > 0 && (
              <WeightSimulator recommendation={results.recommendation} />
            )}

            <div className="space-y-4">
              <h2 className="font-serif text-2xl font-semibold text-ink">
                {mode === "simple" ? "Things to Address" : "Action Required"}
              </h2>
              <div className="border border-rule rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">Vendor</TableHead>
                      <TableHead className="w-[20%]">Category</TableHead>
                      <TableHead className="w-[15%]">
                        {mode === "simple" ? "Urgency" : "Severity"}
                      </TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-ink-muted py-8">
                          {mode === "simple"
                            ? "No issues found yet. Upload vendor documents and run an analysis."
                            : "No alerts found. Run comparison to analyze documents."}
                        </TableCell>
                      </TableRow>
                    ) : alerts.map((alert) => (
                      <TableRow key={alert.id}>
                        <TableCell className="font-medium text-ink">{alert.vendor}</TableCell>
                        <TableCell>{alert.category}</TableCell>
                        <TableCell>
                          <RiskBadge level={alert.severity as any} />
                        </TableCell>
                        <TableCell className="text-ink-muted">
                          <PlainLanguageItem
                            id={alert.id}
                            plainLanguage={alert.plainLanguage}
                            type="cost"
                            expertContent={<span>{alert.details}</span>}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        );
      }}
    </ResultsWrapper>
  );
}
