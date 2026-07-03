"use client";

import { ExecutiveSummaryCard } from "@/components/ExecutiveSummaryCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskBadge } from "@/components/RiskBadge";
import { PipelineRunner } from "@/components/PipelineRunner";
import { ResultsWrapper } from "@/components/ResultsWrapper";

export default function OverviewPage() {
  return (
    <ResultsWrapper>
      {(results) => {
        // Compute summary values from results
        const totalSpend = results?.cost_breakdown?.total_spend || "$0";
        const discrepancies = results?.cost_breakdown?.discrepancies || "$0";
        const vendorsAtRisk = results?.risk_flags?.items?.filter((i: any) => i.financialRisk === "high" || i.securityRisk === "high").length || 0;
        
        // Transform items to alerts for the table
        const alerts = [];
        if (results?.cost_breakdown?.items) {
          alerts.push(...results.cost_breakdown.items.filter((i: any) => i.hasDiscrepancy).map((i: any) => ({
            id: `cost-${i.id}`, vendor: i.vendor, category: "Cost Discrepancy", severity: "high", details: `Stated: ${i.statedPrice}, Actual: ${i.actualPrice}`
          })));
        }
        if (results?.policy_rules?.items) {
          alerts.push(...results.policy_rules.items.filter((i: any) => i.status !== "Compliant").map((i: any) => ({
            id: `policy-${i.id}`, vendor: i.vendor, category: "Compliance", severity: "medium", details: `${i.framework}: ${i.status}`
          })));
        }
        return (
          <div className="space-y-8">
            <div className="flex items-start justify-between relative">
              <div>
                <h1 className="font-serif text-3xl font-semibold text-ink mb-2">Audit Overview</h1>
                <p className="text-ink-muted">High-level summary of vendor costs, risks, and compliance status.</p>
              </div>
        <PipelineRunner />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ExecutiveSummaryCard 
          title="Total Vendor Spend"
          value={totalSpend}
          trend={{ value: "-", direction: "up", label: "based on uploads" }}
        />
        <ExecutiveSummaryCard 
          title="Identified Discrepancies"
          value={discrepancies}
          trend={{ value: "-", direction: "up", label: "found in audit" }}
        />
        <ExecutiveSummaryCard 
          title="Vendors at Risk"
          value={vendorsAtRisk.toString()}
          trend={{ value: "-", direction: "down", label: "requiring review" }}
        />
      </div>

      <div className="space-y-4">
        <h2 className="font-serif text-2xl font-semibold text-ink">Action Required</h2>
        <div className="border border-rule rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Vendor</TableHead>
                <TableHead className="w-[20%]">Category</TableHead>
                <TableHead className="w-[15%]">Severity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-ink-muted py-8">
                    No alerts found. Run comparison to analyze documents.
                  </TableCell>
                </TableRow>
              ) : alerts.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell className="font-medium text-ink">{alert.vendor}</TableCell>
                  <TableCell>{alert.category}</TableCell>
                  <TableCell>
                    <RiskBadge level={alert.severity as any} />
                  </TableCell>
                  <TableCell className="text-ink-muted">{alert.details}</TableCell>
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
