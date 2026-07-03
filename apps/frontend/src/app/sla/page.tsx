"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScoreBar } from "@/components/ScoreBar";
import { Button } from "@/components/ui/button";
import { ResultsWrapper } from "@/components/ResultsWrapper";

export default function SLATrackerPage() {
  return (
    <ResultsWrapper>
      {(results) => {
        // Since SLA might not be explicitly modeled yet in our backend mock structure,
        // we map it gracefully from existing structures or fallback to empty.
        const SLA_DATA = results?.sla_metrics?.items || [];
        return (
          <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink mb-2">SLA Tracker</h1>
          <p className="text-ink-muted">Monitor vendor service level agreements and identify missed targets.</p>
        </div>
        <Button>Calculate Credits</Button>
      </div>

      <div className="border border-rule rounded-md overflow-hidden bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[20%]">Vendor</TableHead>
              <TableHead className="w-[25%]">Metric</TableHead>
              <TableHead className="w-[15%]">Target</TableHead>
              <TableHead className="w-[15%]">Actual</TableHead>
              <TableHead className="w-[15%]">Status</TableHead>
              <TableHead className="w-[10%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SLA_DATA.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-ink-muted">No SLA data found.</TableCell>
              </TableRow>
            ) : SLA_DATA.map((row: any) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-ink">{row.vendor}</TableCell>
                <TableCell>{row.metric}</TableCell>
                <TableCell className="font-mono tabular-nums">{row.target}</TableCell>
                <TableCell className="font-mono tabular-nums text-ink">{row.actual}</TableCell>
                <TableCell>
                  {row.status === "met" ? (
                    <span className="text-verdigris font-medium text-sm">Target Met</span>
                  ) : (
                    <span className="text-audit-red font-medium text-sm">Target Missed</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" className="text-navy font-medium">Log Incident</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
          </div>
        );
      }}
    </ResultsWrapper>
  );
}
