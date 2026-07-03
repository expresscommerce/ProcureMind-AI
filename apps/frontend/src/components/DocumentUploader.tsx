"use client";

import { useRef, useState } from "react";
import { Button } from "./ui/button";
import { useProject } from "@/lib/project";
import { apiFetch } from "@/lib/api";

export function DocumentUploader({ label = "Upload Proposal", variant = "default", size = "default" }: { label?: string, variant?: any, size?: any }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [vendorName, setVendorName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { currentProject } = useProject();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !vendorName.trim() || !currentProject) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("vendor_name", vendorName.trim());

    try {
      await apiFetch(`/projects/${currentProject.id}/documents`, {
        method: "POST",
        body: formData,
      });
      setIsModalOpen(false);
      setVendorName("");
      setSelectedFile(null);
      // Dispatch refresh event to update vendor directory & documents
      window.dispatchEvent(new CustomEvent("refresh-results"));
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };
  return (
    <>
      <Button 
        variant={variant} 
        size={size} 
        onClick={() => setIsModalOpen(true)}
        disabled={!currentProject}
      >
        {label}
      </Button>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm">
          <div className="bg-surface border border-rule rounded-md p-6 w-[400px] shadow-lg">
            <h2 className="font-serif text-2xl text-ink font-semibold mb-4">Add Vendor Document</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Vendor Name</label>
                <input 
                  type="text" 
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g. Databricks"
                  className="w-full border border-rule rounded-sm px-3 py-2 text-sm text-ink focus:outline-none focus:border-navy"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">Document File</label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".pdf,.docx,.doc"
                    onChange={handleFileChange}
                  />
                  <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                    Choose File
                  </Button>
                  <span className="text-sm text-ink-muted truncate max-w-[200px]">
                    {selectedFile ? selectedFile.name : "No file selected"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={handleUpload} disabled={uploading || !selectedFile || !vendorName.trim()}>
                {uploading ? "Uploading..." : "Add Vendor"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
