"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useProject } from "@/lib/project";
import { apiFetch } from "@/lib/api";

export function ResultsWrapper({
  children,
}: {
  children: (results: Record<string, any> | null) => React.ReactNode;
}) {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();

  const {
    data: results,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["results", currentProject?.id],
    queryFn: () =>
      apiFetch(`/projects/${currentProject!.id}/results`),
    enabled: !!currentProject,
    staleTime: Infinity,
  });

  useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({
        queryKey: ["results", currentProject?.id],
      });
    };

    window.addEventListener("refresh-results", refresh);

    return () => {
      window.removeEventListener("refresh-results", refresh);
    };
  }, [currentProject, queryClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-6 h-6 border-2 border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error instanceof Error) {
    return (
      <div className="text-audit-red p-4 border border-audit-red/20 bg-audit-red/5 rounded-md text-sm">
        {error.message}
      </div>
    );
  }

  return <>{children(results ?? null)}</>;
}