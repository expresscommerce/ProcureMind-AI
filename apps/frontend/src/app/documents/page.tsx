"use client";

import { supabase } from "@/lib/supabase";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DocumentUploader } from "@/components/DocumentUploader";
import { useProject } from "@/lib/project";
import { apiFetch } from "@/lib/api";

export default function VendorDocumentsPage() {
  const { currentProject } = useProject();
  const [documents, setDocuments] = useState<any[]>([]);

  const fetchDocuments = () => {
    if (currentProject?.id) {
      apiFetch(`/projects/${currentProject.id}/documents`)
        .then(data => setDocuments(data))
        .catch(err => console.error("Failed to load documents", err));
    } else {
      setDocuments([]);
    }
  };

  useEffect(() => {
    fetchDocuments();

    const handleRefresh = () => fetchDocuments();
    window.addEventListener("refresh-results", handleRefresh);

    return () => {
      window.removeEventListener("refresh-results", handleRefresh);
    };
  }, [currentProject?.id]);

  useEffect(() => {
    const hasProcessing = documents.some(
      (doc) => doc.status === "Processing" || doc.raw_status === "processing"
    );
    if (!hasProcessing) return;

    const timer = setInterval(() => {
      fetchDocuments();
    }, 2000);

    return () => clearInterval(timer);
  }, [documents, currentProject?.id]);

  const handleDelete = async (docId: string) => {
    if (!currentProject) return;
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      await apiFetch(`/projects/${currentProject.id}/documents/${docId}`, {
        method: "DELETE"
      });
      fetchDocuments();
      console.log("Dispatching refresh-results event in document deletion ");
      window.dispatchEvent(new CustomEvent("refresh-results"));
      console.log("Event dispatched");
    } catch (err) {
      alert("Failed to delete document");
    }
  };

  const handleView = async (docId: string) => {
    if (!currentProject) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_URL}/projects/${currentProject.id}/documents/${docId}/download`, {
        headers: { "Authorization": `Bearer ${session.access_token}` }
      });
      if (!res.ok) throw new Error("Failed to load document");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error(err);
      alert("Error loading document");
    }
  }

  return (

    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink mb-2">Vendor Documents</h1>
          <p className="text-ink-muted">Centralized repository for all vendor contracts, DPAs, and order forms.</p>
        </div>
        <DocumentUploader label="Upload Document" />
      </div>

      <div className="border border-rule rounded-md overflow-hidden bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[20%]">Vendor</TableHead>
              <TableHead className="w-[30%]">Document Name</TableHead>
              <TableHead className="w-[15%]">Type</TableHead>
              <TableHead className="w-[15%]">Date</TableHead>
              <TableHead className="w-[10%]">Status</TableHead>
              <TableHead className="w-[10%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-ink-muted">No documents uploaded yet.</TableCell>
              </TableRow>
            ) : documents.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-ink">{row.vendor}</TableCell>
                <TableCell className="text-ink">{row.name}</TableCell>
                <TableCell>{row.type}</TableCell>
                <TableCell className="font-mono tabular-nums">{row.date}</TableCell>
                <TableCell>
                  {row.status === "Active" ? (
                    <span className="text-verdigris font-medium text-sm flex items-center gap-1">
                      <span>✓</span> Active
                    </span>
                  ) : row.status === "Processing" ? (
                    <span className="text-amber-600 font-medium text-sm animate-pulse flex items-center gap-1">
                      <span className="inline-block animate-spin">⏳</span> Processing...
                    </span>
                  ) : (
                    <span className="text-audit-red font-medium text-sm flex items-center gap-1">
                      <span>✕</span> Failed
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-navy font-medium"
                    onClick={() => handleView(row.id)}
                  >
                    View
                  </Button>
                  <Button variant="ghost" size="sm" className="text-audit-red font-medium" onClick={() => handleDelete(row.id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
