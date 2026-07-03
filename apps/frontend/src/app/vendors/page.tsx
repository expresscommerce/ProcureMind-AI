"use client";

import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/RiskBadge";
import { DocumentUploader } from "@/components/DocumentUploader";
import { Modal } from "@/components/Modal";

import { ResultsWrapper } from "@/components/ResultsWrapper";
import { useProject } from "@/lib/project";
import { apiFetch } from "@/lib/api";

export default function VendorDirectoryPage() {
  const { currentProject } = useProject();
  const [selectedVendor, setSelectedVendor] = useState<any>(null);

  const handleDelete = async (vendorName: string) => {
    if (!currentProject) return;
    if (!confirm("Are you sure you want to delete this vendor?")) return;
    try {
      await apiFetch(`/projects/${currentProject.id}/vendors/${encodeURIComponent(vendorName)}`, {
        method: "DELETE"
      });
      window.dispatchEvent(new CustomEvent("refresh-results"));
    } catch (err) {
      alert("Failed to delete vendor");
    }
  };

  return (
    <ResultsWrapper>
      {(results) => {
        const vendors = results?.structured_proposal?.vendors || [];
        return (
          <div className="space-y-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-serif text-3xl font-semibold text-ink mb-2">Vendor Directory</h1>
                <p className="text-ink-muted">Master list of all active vendors and business owners.</p>
              </div>
              <DocumentUploader label="Add Vendor" />
            </div>

            <div className="border border-rule rounded-md overflow-hidden bg-surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[20%]">Vendor Name</TableHead>
                    <TableHead className="w-[20%]">Category</TableHead>
                    <TableHead className="w-[20%]">Internal Owner</TableHead>
                    <TableHead className="w-[15%]">Annual Spend</TableHead>
                    <TableHead className="w-[15%]">Risk Profile</TableHead>
                    <TableHead className="w-[10%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-ink-muted">
                        No vendors found. Upload documents and run comparison.
                      </TableCell>
                    </TableRow>
                  ) : vendors.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-ink">{row.name}</TableCell>
                      <TableCell>{row.category}</TableCell>
                      <TableCell>{row.owner || "Unassigned"}</TableCell>
                      <TableCell className="font-mono tabular-nums text-ink">{row.spend || "-"}</TableCell>
                      <TableCell>
                        <RiskBadge level={(row.risk || "low") as any} />
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-navy font-medium"
                          onClick={() => setSelectedVendor(row)}
                        >
                          Profile
                        </Button>
                        <Button variant="ghost" size="sm" className="text-audit-red font-medium" onClick={() => handleDelete(row.name)}>Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {selectedVendor && (
              <Modal
                isOpen={!!selectedVendor}
                onClose={() => setSelectedVendor(null)}
                title="Vendor Profile"
              >
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">Vendor Name</span>
                      <span className="text-ink font-medium text-base">{selectedVendor.name}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">Category</span>
                      <span className="text-ink font-medium text-base">{selectedVendor.category}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">Annual Cost</span>
                      <span className="text-ink font-mono font-medium text-base">{selectedVendor.spend || selectedVendor.annualCost || "-"}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">Risk Profile</span>
                      <div className="mt-1"><RiskBadge level={selectedVendor.risk || "low"} /></div>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">SSO Support</span>
                      <span className="text-ink font-medium">{selectedVendor.ssoSupport || "No"}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">Data Retention</span>
                      <span className="text-ink font-medium">{selectedVendor.dataRetention || "Not specified"}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">SLA Uptime</span>
                      <span className="text-ink font-medium">{selectedVendor.slaUptime || "Not specified"}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-xs font-semibold uppercase tracking-wider">Internal Owner</span>
                      <span className="text-ink font-medium">{selectedVendor.owner || "Unassigned"}</span>
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
