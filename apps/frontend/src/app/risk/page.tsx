"use client";

import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskBadge } from "@/components/RiskBadge";
import { ScoreBar } from "@/components/ScoreBar";
import { Button } from "@/components/ui/button";
import { ResultsWrapper } from "@/components/ResultsWrapper";
import { Modal } from "@/components/Modal";

export default function RiskAssessmentPage() {
  const [selectedRisk, setSelectedRisk] = useState<any>(null);

  return (
    <ResultsWrapper>
      {(results) => {
        const RISK_DATA = results?.risk_flags?.items || [];
        return (
          <div className="space-y-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-serif text-3xl font-semibold text-ink mb-2">Risk Assessment Matrix</h1>
                <p className="text-ink-muted">Evaluate vendor health across financial, security, and operational domains.</p>
              </div>
              <Button onClick={() => alert("Assessment running (simulated)")}>Run Assessment</Button>
            </div>

            <div className="border border-rule rounded-md overflow-hidden bg-surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[15%]">Vendor</TableHead>
                    <TableHead className="w-[20%]">Overall Health</TableHead>
                    <TableHead className="w-[15%]">Financial</TableHead>
                    <TableHead className="w-[15%]">Security</TableHead>
                    <TableHead className="w-[15%]">Operational</TableHead>
                    <TableHead className="w-[10%]">Next Review</TableHead>
                    <TableHead className="w-[10%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {RISK_DATA.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-ink-muted">No risk data found.</TableCell>
                    </TableRow>
                  ) : RISK_DATA.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-ink">{row.vendor}</TableCell>
                      <TableCell>
                        <ScoreBar score={row.overallScore} />
                      </TableCell>
                      <TableCell><RiskBadge level={row.financialRisk as any} /></TableCell>
                      <TableCell><RiskBadge level={row.securityRisk as any} /></TableCell>
                      <TableCell><RiskBadge level={row.operationalRisk as any} /></TableCell>
                      <TableCell className="font-mono tabular-nums">{row.nextReview}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-navy font-medium"
                          onClick={() => setSelectedRisk(row)}
                        >
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {selectedRisk && (
              <Modal
                isOpen={!!selectedRisk}
                onClose={() => setSelectedRisk(null)}
                title="Risk Assessment Details"
              >
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">Vendor</span>
                      <span className="text-ink font-medium text-base">{selectedRisk.vendor}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">Overall Health Score</span>
                      <span className="text-ink font-mono font-medium text-base">{selectedRisk.overallScore}/100</span>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">Financial Risk</span>
                      <div className="mt-1"><RiskBadge level={selectedRisk.financialRisk} /></div>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">Security Risk</span>
                      <div className="mt-1"><RiskBadge level={selectedRisk.securityRisk} /></div>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">Operational Risk</span>
                      <div className="mt-1"><RiskBadge level={selectedRisk.operationalRisk} /></div>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">Next Review Date</span>
                      <span className="text-ink font-mono">{selectedRisk.nextReview || "-"}</span>
                    </div>
                  </div>
                </div>
              </Modal>
            )}
          </div>
        );
      }}
    </ResultsWrapper>
  );
}
