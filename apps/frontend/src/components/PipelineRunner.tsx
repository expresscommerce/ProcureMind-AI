"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { useProject } from "@/lib/project";
import { apiFetch } from "@/lib/api";

type PipelineStep = {
  name: string;
  status: "pending" | "running" | "done";
};

type PipelineStatus = {
  status: "not_started" | "running" | "completed" | "error";
  current_step?: string;
  current_sub_step?: string;
  steps: PipelineStep[];
  error?: string;
};

const STEPS = [
  "Document Parsing",
  "Information Extraction",
  "Cost Analysis",
  "Saving Results"
];

export function PipelineRunner() {
  const { currentProject } = useProject();
  const [status, setStatus] = useState<PipelineStatus>({ status: "not_started", steps: [] });
  const [loading, setLoading] = useState(false);
  const [missingSections, setMissingSections] = useState<{ name: string, message: string }[]>([]);
  const wasRunningRef = useRef(false);

  function getMissingSections(results: any): { name: string, message: string }[] {
    if(!results) return [];
    const missing: { name: string, message: string }[] = [];

    const vendors = results?.structured_proposal?.vendors || [];
    if (vendors.length === 0) { return []; }

    const summary = results?.score_results?.executive_summary;
    if (!summary?.key_findings?.length){
      missing.push({ name: "Key Findings", message: "No key findings were generated." });
    }

    const pl = results?.plain_language || {};
    if(!pl.cost_explanations?.length && !pl.risk_explanations?.length && !pl.compliance_explanations?.length && !pl.sla_explanations?.length){
      missing.push({ name: "Plain Language", message: "No plain language explanations were generated." });
    }

    const rec = results?.recommendation;
    if(!rec.recommended_vendor || !rec.vendor_scores?.length){
      missing.push({ name: "Recommendation", message: "No recommendation and vendor scores were generated." });
    }

    const insightMsg = String(results?.insight?.insight ?? "");
    if (results?.insight?.found === false && (insightMsg.includes("failed") || insightMsg.includes("encountered an error"))){
      missing.push({ name: "Insight", message: "The insight generation failed." });
    }
    return missing;
  }

  useEffect(() => {
    if (!currentProject) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const checkStatus = async () => {
      try {
        const data = await apiFetch(`/projects/${currentProject.id}/status`);
        if (cancelled) return;
        setStatus(data);

        if (data.status === "running") {
          wasRunningRef.current = true;
          // Poll fast while running
          if (!intervalId) {
            intervalId = setInterval(checkStatus, 1000);
          }
        } else if (data.status === "completed" && wasRunningRef.current) {
          wasRunningRef.current = false;
          console.log("Dispatching refresh-results event for pipeline completion");
          window.dispatchEvent(new CustomEvent("refresh-results"));
          console.log("Event dispatched");
          // Stop fast polling once completed
          if (intervalId) { clearInterval(intervalId); intervalId = null; }
          // Check for missing sections in the results
          try{
            const results = await apiFetch(`/projects/${currentProject.id}/results`);
             if (!cancelled) setMissingSections(getMissingSections(results));
          } catch (e) {
            console.error("Failed to check for missing sections", e);
          }

        } else if (data.status === "not_started" && wasRunningRef.current) {
          // Server restarted mid-pipeline — clear stale running state
          wasRunningRef.current = false;
          if (intervalId) { clearInterval(intervalId); intervalId = null; }
        } else if (data.status === "error") {
          wasRunningRef.current = false;
          if (intervalId) { clearInterval(intervalId); intervalId = null; }
        }
      } catch (e) {
        console.error("Status check failed", e);
      }
    };

    // Initial check + slow background poll (every 5s when idle)
    checkStatus();
    const slowInterval = setInterval(() => {
      // Only poll slowly when not already fast-polling
      if (!intervalId) checkStatus();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(slowInterval);
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentProject]);

  const [isProcessingDocs, setIsProcessingDocs] = useState(false);
  const [hasDocs, setHasDocs] = useState(false);
  const docsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!currentProject) return;

    const checkDocs = async () => {
      try {
        const docs = await apiFetch(`/projects/${currentProject.id}/documents`);
        setHasDocs(docs.length > 0);
        const processing = docs.some(
          (d: any) => d.status === "Processing" || d.raw_status === "processing"
        );
        setIsProcessingDocs(processing);

        if (!processing && docsIntervalRef.current) {
          // All docs ready — stop polling to end the terminal loop
          clearInterval(docsIntervalRef.current);
          docsIntervalRef.current = null;
        }
      } catch (e) {
        console.error("Failed to check document statuses", e);
      }
    };

    checkDocs();

    // Listen for upload events to re-enable polling instantly
    const handleRefresh = () => {
      checkDocs();
      // Re-start fast polling when a new upload arrives
      if (!docsIntervalRef.current) {
        docsIntervalRef.current = setInterval(checkDocs, 1000);
      }
    };
    
    window.addEventListener("refresh-results", handleRefresh);

    return () => {
      window.removeEventListener("refresh-results", handleRefresh);
      if (docsIntervalRef.current) {
        clearInterval(docsIntervalRef.current);
        docsIntervalRef.current = null;
      }
    };
  }, [currentProject]);

  const handleRun = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      await apiFetch(`/projects/${currentProject.id}/run`, { method: "POST" });
      setStatus({
        status: "running",
        current_step: "Document Parsing",
        steps: STEPS.map(name => ({ name, status: "pending" as const }))
      });
      wasRunningRef.current = true;
    } catch (e: unknown) {
      alert(`Run failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  if (!currentProject) return null;

  return (
    <div className="flex flex-col items-end gap-2 relative">
      <Button 
        onClick={handleRun} 
        disabled={loading || status.status === "running" || isProcessingDocs || !hasDocs}
        title={isProcessingDocs ? "Please wait for all documents to finish extraction" : ""}
      >
        {status.status === "running" 
          ? "Running Pipeline..." 
          : isProcessingDocs 
          ? "Extracting Docs..." 
          : "Run Analysis"}
      </Button>
      
      {status.status === "error" && status.error && (
        <div className="text-sm bg-red-50 border border-red-300 p-3 rounded-md shadow-sm mt-2 w-80 max-w-[calc(100vw-2rem)] absolute top-full right-0 z-10">
          <div className="font-medium text-red-700 mb-1">Pipeline Error</div>
          <div className="text-xs text-red-600 break-words">{status.error}</div>
        </div>
      )}
      {status.status === "completed" && missingSections.length > 0 && (
        <div className="text-sm bg-surface border border-rule p-3 rounded-md shadow-sm mt-2 w-80 max-w-[calc(100vw-2rem)] absolute top-full right-0 z-10">
          <div className="font-medium text-ink mb-2">
            Some results couldn't be generated
          </div>
          <ul className="mb-3 space-y-2">
            {missingSections.map((s) => (
              <li key={s.name} className="text-xs">
                <span className="font-medium text-audit-red">{s.name}:</span>{" "}
                <span className="text-ink-muted">{s.message}</span>
              </li>
            ))}
          </ul>
          <Button onClick={handleRun} disabled={loading} className="w-full">
            Run pipeline again
          </Button>
        </div>
      )}
      {status.status === "running" && status.steps.length > 0 && (
        <div className="text-sm bg-surface border border-rule p-3 rounded-md shadow-sm mt-2 w-72 max-w-[calc(100vw-2rem)] absolute top-full right-0 z-10">
          <div className="font-medium text-ink mb-2">Pipeline Progress</div>
          <div className="space-y-1">
            {status.steps.map((step, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between text-xs">
                  <span className={step.status === "running" ? "text-navy font-medium" : "text-ink-muted"}>
                    {step.name}
                  </span>
                  <span>
                    {step.status === "done" && <span className="text-verdigris">✓</span>}
                    {step.status === "running" && <span className="text-navy animate-pulse">...</span>}
                    {step.status === "pending" && <span className="text-rule">-</span>}
                  </span>
                </div>
                {step.status === "running" && status.current_sub_step && (
                  <div className="mt-1 ml-2 flex items-center gap-1 text-xs text-ink-muted italic">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-navy animate-pulse shrink-0" />
                    {status.current_sub_step}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
