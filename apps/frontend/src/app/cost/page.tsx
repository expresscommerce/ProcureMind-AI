"use client";

import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HiddenCostAnnotation } from "@/components/HiddenCostAnnotation";
import { Button } from "@/components/ui/button";
import { ResultsWrapper } from "@/components/ResultsWrapper";
import { Modal } from "@/components/Modal";
import { useViewMode } from "@/lib/viewMode";
import { PlainLanguageItem, getPlainLanguage } from "@/components/PlainLanguageView";

export default function CostAnalysisPage() {
  const [selectedCost, setSelectedCost] = useState<any>(null);
  const { mode } = useViewMode();

  return (
    <ResultsWrapper>
      {(results) => {
        const items = results?.cost_breakdown?.items || [];
        const totalStated = results?.summary?.totalStated || "$0";
        const totalActual = results?.summary?.totalActual || "$0";
        const variance = results?.summary?.variance || "$0";
        const plainLang = results?.plain_language || {};

        return (
          <div className="space-y-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-serif text-3xl font-semibold text-ink mb-2">
                  {mode === "simple" ? "Cost Breakdown" : "Cost Analysis Ledger"}
                </h1>
                <p className="text-ink-muted">
                  {mode === "simple"
                    ? "Here's what your vendors are charging and where we found unexpected costs."
                    : "Detailed breakdown of vendor spend and identified discrepancies."}
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => alert("Report exported (simulated)")}>Export Report</Button>
                <Button onClick={() => alert("Discrepancies reconciled (simulated)")}>Reconcile Discrepancies</Button>
              </div>
            </div>

            <div className="flex items-center gap-12 p-6 border border-rule rounded-md bg-surface">
              <div>
                <div className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-1">
                  {mode === "simple" ? "What They Quoted" : "Stated Total Spend"}
                </div>
                <div className="font-mono text-2xl tabular-nums text-ink">{totalStated}</div>
              </div>
              <div className="h-12 w-px bg-rule"></div>
              <div>
                <div className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-1">
                  {mode === "simple" ? "What It Actually Costs" : "Actual Audited Spend"}
                </div>
                <div className="font-mono text-2xl tabular-nums text-audit-red font-semibold">{totalActual}</div>
              </div>
              <div className="h-12 w-px bg-rule"></div>
              <div>
                <div className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-1">
                  {mode === "simple" ? "Hidden Cost Gap" : "Unaccounted Variance"}
                </div>
                <div className="font-mono text-2xl tabular-nums text-audit-red font-semibold">{variance}</div>
              </div>
            </div>

            {mode === "simple" && items.some((r: any) => r.hasDiscrepancy) && (
              <div className="text-sm text-ink-muted border-l-2 border-audit-red pl-3">
                We found costs that don&apos;t match what was originally quoted. The items highlighted below show the quoted price crossed out with the real cost next to it.
              </div>
            )}

            <div className="space-y-4">
              <h2 className="font-serif text-2xl font-semibold text-ink">
                {mode === "simple" ? "Cost Details" : "Line-Item Breakdown"}
              </h2>
              <div className="border border-rule rounded-md overflow-hidden bg-surface">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[20%]">Vendor</TableHead>
                      <TableHead className="w-[20%]">Category</TableHead>
                      <TableHead className="w-[30%]">
                        {mode === "simple" ? "Cost" : "Audited Cost"}
                      </TableHead>
                      <TableHead className="w-[15%]">Renewal Date</TableHead>
                      <TableHead className="w-[15%] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-ink-muted">
                          {mode === "simple"
                            ? "No cost data yet. Upload vendor documents and run an analysis."
                            : "No cost data found."}
                        </TableCell>
                      </TableRow>
                    ) : items.map((row: any) => {
                      const pl = getPlainLanguage(plainLang, row.id, "cost");
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium text-ink">{row.vendor}</TableCell>
                          <TableCell>{row.category}</TableCell>
                          <TableCell>
                            <PlainLanguageItem
                              id={row.id}
                              plainLanguage={pl}
                              type="cost"
                              expertContent={
                                row.hasDiscrepancy ? (
                                  <HiddenCostAnnotation statedPrice={row.statedPrice} correctedPrice={row.actualPrice} />
                                ) : (
                                  <span className="font-mono tabular-nums text-ink">{row.statedPrice}</span>
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="font-mono tabular-nums">{row.renewal}</TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-navy font-medium"
                              onClick={() => setSelectedCost(row)}
                            >
                              Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {selectedCost && (
              <Modal
                isOpen={!!selectedCost}
                onClose={() => setSelectedCost(null)}
                title="Cost Discrepancy Details"
              >
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">Vendor</span>
                      <span className="text-ink font-medium text-base">{selectedCost.vendor}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">Category</span>
                      <span className="text-ink font-medium text-base">{selectedCost.category}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">Stated Price</span>
                      <span className="text-ink font-mono font-medium">{selectedCost.statedPrice}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">Actual Price</span>
                      <span className="text-ink font-mono font-medium">{selectedCost.actualPrice}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">Has Discrepancy</span>
                      <span className={`font-semibold ${selectedCost.hasDiscrepancy ? 'text-audit-red' : 'text-verdigris'}`}>
                        {selectedCost.hasDiscrepancy ? "Yes" : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">Renewal Date</span>
                      <span className="text-ink font-mono">{selectedCost.renewal || "-"}</span>
                    </div>
                  </div>
                  {selectedCost.hasDiscrepancy && (
                    <div className="p-3 border border-audit-red/20 rounded bg-audit-red/5 text-audit-red text-xs">
                      <strong>Discrepancy Warning:</strong> The actual audited price deviates from the standard stated price. Reconcile billing history or contract terms before processing the next payment.
                    </div>
                  )}
                </div>
              </Modal>
            )}
          </div>
        );
      }}
    </ResultsWrapper>
  );
}
