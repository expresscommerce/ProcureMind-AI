"use client";

import React, { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskBadge } from "@/components/RiskBadge";
import { ScoreBar } from "@/components/ScoreBar";
import { Button } from "@/components/ui/button";
import { ResultsWrapper } from "@/components/ResultsWrapper";
import { Modal } from "@/components/Modal";
import { useViewMode } from "@/lib/viewMode";
import { PlainLanguageItem, getPlainLanguage } from "@/components/PlainLanguageView";
import { useProject } from "@/lib/project";
import { apiFetch } from "@/lib/api";

export default function RiskAssessmentPage() {
  const [selectedRisk, setSelectedRisk] = useState<any>(null);
  const { mode } = useViewMode();
  const { currentProject } = useProject();
  const [mlPredictions, setMlPredictions] = useState<any>(null);
  const [mlLoading, setMlLoading] = useState(false);

  useEffect(() => {
    if (!currentProject) {
      setMlPredictions(null);
      return;
    }

    const fetchPredictions = async () => {
      setMlLoading(true);
      try {
        const data = await apiFetch(`/projects/${currentProject.id}/ml-risk-prediction`, {
          method: "POST",
        });
        setMlPredictions(data);
      } catch (err) {
        console.error("Failed to fetch ML risk predictions:", err);
        setMlPredictions(null);
      } finally {
        setMlLoading(false);
      }
    };

    fetchPredictions();
  }, [currentProject]);

  return (
    <ResultsWrapper>
      {(results) => {
        const RISK_DATA = results?.risk_flags?.items || [];
        const plainLang = results?.plain_language || {};

        return (
          <div className="space-y-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-serif text-3xl font-semibold text-ink mb-2">
                  {mode === "simple" ? "Vendor Risk Check" : "Risk Assessment Matrix"}
                </h1>
                <p className="text-ink-muted">
                  {mode === "simple"
                    ? "How healthy and reliable each vendor is across financial stability, security, and operations."
                    : "Evaluate vendor health across financial, security, and operational domains."}
                </p>
              </div>
              <Button onClick={() => alert("Assessment running (simulated)")}>Run Assessment</Button>
            </div>

            {mode === "simple" && RISK_DATA.length > 0 && (
              <div className="text-sm text-ink-muted border-l-2 border-navy pl-3">
                Each vendor gets a health score out of 100. Higher is better. We also check three specific areas: whether they're financially stable, whether their security is solid, and whether their operations are reliable.
              </div>
            )}

            <div className="border border-rule rounded-md overflow-hidden bg-surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[15%]">Vendor</TableHead>
                    <TableHead className="w-[20%]">
                      {mode === "simple" ? "Health Score" : "Overall Health"}
                    </TableHead>
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
                      <TableCell colSpan={7} className="text-center py-8 text-ink-muted">
                        {mode === "simple"
                          ? "No risk data yet. Upload vendor documents and run an analysis."
                          : "No risk data found."}
                      </TableCell>
                    </TableRow>
                  ) : RISK_DATA.map((row: any) => {
                    const pl = getPlainLanguage(plainLang, row.id, "risk");
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-ink">{row.vendor}</TableCell>
                        <TableCell>
                          {mode === "simple" && pl ? (
                            <PlainLanguageItem
                              id={row.id}
                              plainLanguage={pl}
                              type="risk"
                              expertContent={<ScoreBar score={row.overallScore} />}
                            />
                          ) : (
                            <ScoreBar score={row.overallScore} />
                          )}
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* --- Phase 6 ML Prediction Section --- */}
            {mlPredictions?.predictions && Object.keys(mlPredictions.predictions).length > 0 && (
              <div className="space-y-4 pt-6 border-t border-rule">
                <div>
                  <h2 className="font-serif text-2xl font-semibold text-ink mb-1">
                    Modeled Risk Estimate
                  </h2>
                  <p className="text-sm text-ink-muted">
                    Modeled risk estimate — improves as more real outcomes are logged.
                  </p>
                </div>

                <div className="border border-rule rounded-md overflow-hidden bg-surface">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Probability of Late Delivery</TableHead>
                        <TableHead>Probability of Hidden Costs</TableHead>
                        <TableHead className="text-right">Modeled Risk Score (0-10)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(mlPredictions.predictions).map(([vendorId, pred]: [string, any]) => (
                        <TableRow key={vendorId}>
                          <TableCell className="font-medium text-ink">{pred.vendor_name}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {(pred.late_delivery_prob * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {(pred.hidden_costs_prob * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-audit-red">
                            {pred.risk_realized_score.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

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
