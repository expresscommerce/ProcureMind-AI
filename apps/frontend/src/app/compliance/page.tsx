"use client";

import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskBadge } from "@/components/RiskBadge";
import { Button } from "@/components/ui/button";
import { ResultsWrapper } from "@/components/ResultsWrapper";
import { Modal } from "@/components/Modal";
import { useViewMode } from "@/lib/viewMode";
import { PlainLanguageItem, getPlainLanguage } from "@/components/PlainLanguageView";
import { GlossaryTerm } from "@/components/GlossaryTerm";

export default function CompliancePage() {
  const [selectedCompliance, setSelectedCompliance] = useState<any>(null);
  const { mode } = useViewMode();

  return (
    <ResultsWrapper>
      {(results) => {
        const COMPLIANCE_DATA = results?.policy_rules?.items || [];
        const plainLang = results?.plain_language || {};

        return (
          <div className="space-y-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-serif text-3xl font-semibold text-ink mb-2">
                  {mode === "simple" ? "Compliance Check" : "Compliance & Audit Trail"}
                </h1>
                <p className="text-ink-muted">
                  {mode === "simple"
                    ? "Whether each vendor meets the security and regulatory standards your organization requires."
                    : "Track regulatory frameworks and missing compliance documentation."}
                </p>
              </div>
              <Button onClick={() => alert("Documentation request sent (simulated)")}>Request Documentation</Button>
            </div>

            {mode === "simple" && COMPLIANCE_DATA.length > 0 && (
              <div className="text-sm text-ink-muted border-l-2 border-navy pl-3">
                Each vendor should have up-to-date certifications like <GlossaryTerm term="SOC 2">SOC 2</GlossaryTerm>, <GlossaryTerm term="GDPR">GDPR</GlossaryTerm>, and <GlossaryTerm term="ISO 27001">ISO 27001</GlossaryTerm>. Items marked &quot;Compliant&quot; are good. Anything else needs attention.
              </div>
            )}

            <div className="border border-rule rounded-md overflow-hidden bg-surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[20%]">Vendor</TableHead>
                    <TableHead className="w-[20%]">Framework</TableHead>
                    <TableHead className="w-[20%]">Status</TableHead>
                    <TableHead className="w-[15%]">Expiration</TableHead>
                    <TableHead className="w-[10%]">Findings</TableHead>
                    <TableHead className="w-[15%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {COMPLIANCE_DATA.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-ink-muted">
                        {mode === "simple"
                          ? "No compliance data yet. Upload vendor documents and run an analysis."
                          : "No compliance data found."}
                      </TableCell>
                    </TableRow>
                  ) : COMPLIANCE_DATA.map((row: any) => {
                    const pl = getPlainLanguage(plainLang, row.id, "compliance");
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-ink">{row.vendor}</TableCell>
                        <TableCell>
                          <GlossaryTerm term={row.framework}>{row.framework}</GlossaryTerm>
                        </TableCell>
                        <TableCell>
                          {mode === "simple" && pl ? (
                            <PlainLanguageItem
                              id={row.id}
                              plainLanguage={pl}
                              type="compliance"
                              expertContent={
                                row.status === "Compliant" ? (
                                  <RiskBadge level="low" label="Compliant" />
                                ) : row.status === "Under Review" ? (
                                  <RiskBadge level="medium" label="Under Review" />
                                ) : (
                                  <RiskBadge level="high" label={row.status} />
                                )
                              }
                            />
                          ) : (
                            row.status === "Compliant" ? (
                              <RiskBadge level="low" label="Compliant" />
                            ) : row.status === "Under Review" ? (
                              <RiskBadge level="medium" label="Under Review" />
                            ) : (
                              <RiskBadge level="high" label={row.status} />
                            )
                          )}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">{row.expires}</TableCell>
                        <TableCell className="font-mono tabular-nums">{row.findings}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-navy font-medium"
                            onClick={() => setSelectedCompliance(row)}
                          >
                            View Report
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {selectedCompliance && (
              <Modal
                isOpen={!!selectedCompliance}
                onClose={() => setSelectedCompliance(null)}
                title="Compliance Details"
              >
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">Vendor</span>
                      <span className="text-ink font-medium text-base">{selectedCompliance.vendor}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">Framework</span>
                      <span className="text-ink font-medium text-base">{selectedCompliance.framework}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">Compliance Status</span>
                      <div className="mt-1">
                        {selectedCompliance.status === "Compliant" ? (
                          <RiskBadge level="low" label="Compliant" />
                        ) : selectedCompliance.status === "Under Review" ? (
                          <RiskBadge level="medium" label="Under Review" />
                        ) : (
                          <RiskBadge level="high" label={selectedCompliance.status} />
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">Expiration Date</span>
                      <span className="text-ink font-mono">{selectedCompliance.expires || "-"}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">Audit Findings</span>
                      <span className="text-ink font-mono font-medium">{selectedCompliance.findings || 0} findings</span>
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
