"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScoreBar } from "@/components/ScoreBar";
import { Button } from "@/components/ui/button";
import { ResultsWrapper } from "@/components/ResultsWrapper";
import { useViewMode } from "@/lib/viewMode";
import { PlainLanguageItem, getPlainLanguage } from "@/components/PlainLanguageView";
import { GlossaryTerm } from "@/components/GlossaryTerm";

export default function SLATrackerPage() {
  const { mode } = useViewMode();

  return (
    <ResultsWrapper>
      {(results) => {
        const SLA_DATA = results?.sla_metrics?.items || [];
        const plainLang = results?.plain_language || {};

        return (
          <div className="space-y-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-serif text-3xl font-semibold text-ink mb-2">
                  {mode === "simple" ? "Service Level Tracking" : <><GlossaryTerm term="SLA">SLA</GlossaryTerm> Tracker</>}
                </h1>
                <p className="text-ink-muted">
                  {mode === "simple"
                    ? "Are your vendors delivering the performance they promised? Here's how they're actually doing."
                    : "Monitor vendor service level agreements and identify missed targets."}
                </p>
              </div>
              <Button>Calculate Credits</Button>
            </div>

            {mode === "simple" && SLA_DATA.length > 0 && (
              <div className="text-sm text-ink-muted border-l-2 border-navy pl-3">
                Each row shows a specific performance promise (like <GlossaryTerm term="uptime">uptime</GlossaryTerm>) — what the vendor committed to, what they actually delivered, and whether they met the target.
              </div>
            )}

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
                      <TableCell colSpan={6} className="text-center py-8 text-ink-muted">
                        {mode === "simple"
                          ? "No service level data yet. Upload vendor documents and run an analysis."
                          : "No SLA data found."}
                      </TableCell>
                    </TableRow>
                  ) : SLA_DATA.map((row: any) => {
                    const pl = getPlainLanguage(plainLang, row.id, "sla");
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-ink">{row.vendor}</TableCell>
                        <TableCell>{row.metric}</TableCell>
                        <TableCell className="font-mono tabular-nums">{row.target}</TableCell>
                        <TableCell className="font-mono tabular-nums text-ink">{row.actual}</TableCell>
                        <TableCell>
                          {mode === "simple" && pl ? (
                            <PlainLanguageItem
                              id={row.id}
                              plainLanguage={pl}
                              type="sla"
                              expertContent={
                                row.status === "met" ? (
                                  <span className="text-verdigris font-medium text-sm">Target Met</span>
                                ) : (
                                  <span className="text-audit-red font-medium text-sm">Target Missed</span>
                                )
                              }
                            />
                          ) : (
                            row.status === "met" ? (
                              <span className="text-verdigris font-medium text-sm">Target Met</span>
                            ) : (
                              <span className="text-audit-red font-medium text-sm">Target Missed</span>
                            )
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-navy font-medium">Log Incident</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      }}
    </ResultsWrapper>
  );
}
