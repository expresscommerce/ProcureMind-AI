"use client";

import { useState, useEffect } from "react";
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
  steps: PipelineStep[];
};

export function PipelineRunner() {
  const { currentProject } = useProject();
  const [status, setStatus] = useState<PipelineStatus>({ status: "not_started", steps: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentProject) return;
    
    let interval: NodeJS.Timeout;
    
    const checkStatus = async () => {
      try {
        const data = await apiFetch(`/projects/${currentProject.id}/status`);
        setStatus(data);
        if (data.status === "running") {
          interval = setTimeout(checkStatus, 1000);
        } else if (data.status === "completed" && status.status === "running") {
          // If it just completed, refresh the page to load new data
          window.location.reload();
        }
      } catch (e) {
        console.error("Status check failed", e);
      }
    };

    checkStatus();

    return () => clearTimeout(interval);
  }, [currentProject, status.status]);

  const handleRun = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      await apiFetch(`/projects/${currentProject.id}/run`, { method: "POST" });
      setStatus({ ...status, status: "running" });
    } catch (e: any) {
      alert(`Run failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!currentProject) return null;

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={handleRun} disabled={loading || status.status === "running"}>
        {status.status === "running" ? "Running Pipeline..." : "Run Comparison"}
      </Button>
      
      {status.status === "running" && status.steps.length > 0 && (
        <div className="text-sm bg-surface border border-rule p-3 rounded-md shadow-sm mt-2 w-64 absolute top-20 right-8 z-10">
          <div className="font-medium text-ink mb-2">Pipeline Progress</div>
          <div className="space-y-1">
            {status.steps.map((step, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className={step.status === "running" ? "text-navy font-medium" : "text-ink-muted"}>
                  {step.name}
                </span>
                <span>
                  {step.status === "done" && <span className="text-verdigris">✓</span>}
                  {step.status === "running" && <span className="text-navy animate-pulse">...</span>}
                  {step.status === "pending" && <span className="text-rule">-</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
