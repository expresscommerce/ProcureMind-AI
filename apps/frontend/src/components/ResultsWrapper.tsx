"use client";

import { useEffect, useState } from "react";
import { useProject } from "@/lib/project";
import { apiFetch } from "@/lib/api";

export function ResultsWrapper({ children }: { children: (results: Record<string, any> | null) => React.ReactNode }) {
  const { currentProject } = useProject();
  const [results, setResults] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentProject) {
      setLoading(false);
      return;
    }

    const loadResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch(`/projects/${currentProject.id}/results`);
        setResults(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    };

    loadResults();

    window.addEventListener("refresh-results", loadResults);
    return () => window.removeEventListener("refresh-results", loadResults);
  }, [currentProject]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-6 h-6 border-2 border-navy border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-audit-red p-4 border border-audit-red/20 bg-audit-red/5 rounded-md text-sm">{error}</div>;
  }

  return <>{children(results)}</>;
}
