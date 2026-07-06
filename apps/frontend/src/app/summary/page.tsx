"use client";

import { useState } from "react";
import { ExecutiveSummaryCard } from "@/components/ExecutiveSummaryCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResultsWrapper } from "@/components/ResultsWrapper";
import { useProject } from "@/lib/project";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useViewMode } from "@/lib/viewMode";
import { RedTeamSection } from "@/components/RedTeamSection";
import { InsightCallout } from "@/components/InsightCallout";

export default function ExecutiveSummaryPage() {
  const { currentProject } = useProject();
  const [downloading, setDownloading] = useState(false);
  const { mode } = useViewMode();

  const handleDownloadPdf = async () => {
    if (!currentProject) return;
    setDownloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");
      
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_URL}/projects/${currentProject.id}/export/pdf`, {
        headers: { "Authorization": `Bearer ${session.access_token}` }
      });
      if (!res.ok) throw new Error("Failed to download PDF");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `executive_summary_${currentProject.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Error generating PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <ResultsWrapper>
      {(results) => {
        const totalRecoverable = results?.cost_breakdown?.discrepancies || "$0";
        const vendorsAudited = results?.structured_proposal?.vendors?.length || 0;
        const criticalAlerts = results?.risk_flags?.high || 0;
        
        const hasData = vendorsAudited > 0;
        
        const keyFindings = results?.score_results?.executive_summary?.key_findings || [];
        const recommendedActions = results?.score_results?.executive_summary?.recommended_actions || [];

        return (
          <div className="space-y-8">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-serif text-3xl font-semibold text-ink mb-2">
                  {mode === "simple" ? "Summary Report" : "Executive Summary"}
                </h1>
                <p className="text-ink-muted">
                  {mode === "simple"
                    ? "The big picture: what the analysis found and what you should do next."
                    : "High-level report on vendor audit findings for the board."}
                </p>
              </div>
              <Button 
                onClick={handleDownloadPdf}
                disabled={!currentProject || !hasData || downloading}
              >
                {downloading ? "Generating..." : "Generate PDF Report"}
              </Button>
            </div>

            {/* Insight callout */}
            <InsightCallout insight={results?.insight} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ExecutiveSummaryCard 
                title={mode === "simple" ? "Money You Could Recover" : "Total Recoverable Cost"}
                value={totalRecoverable}
                trend={{ value: "$0", direction: "up", label: "newly identified" }}
              />
              <ExecutiveSummaryCard 
                title={mode === "simple" ? "Vendors Reviewed" : "Vendors Audited"}
                value={vendorsAudited.toString()}
                trend={{ value: "0%", direction: "up", label: "coverage complete" }}
              />
              <ExecutiveSummaryCard 
                title={mode === "simple" ? "Urgent Concerns" : "Critical Risk Alerts"}
                value={criticalAlerts.toString()}
                trend={{ value: "0", direction: "down", label: "resolved this week" }}
              />
            </div>

            {/* Recommendation + Red-Team */}
            {results?.recommendation?.recommended_vendor && (
              <RedTeamSection 
                redTeam={results?.red_team}
                recommendation={results?.recommendation}
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {mode === "simple" ? "What We Found" : "Key Strategic Findings"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!hasData ? (
                    <p className="text-sm text-ink-muted">
                      {mode === "simple"
                        ? "No findings yet. Upload vendor documents and run an analysis."
                        : "No findings generated yet. Upload documents and run pipeline."}
                    </p>
                  ) : keyFindings.length === 0 ? (
                    <p className="text-sm text-ink-muted">Generating key strategic findings...</p>
                  ) : (
                    <ul className="list-disc pl-5 space-y-2 text-sm text-ink-muted">
                      {keyFindings.map((finding: string, idx: number) => (
                        <li key={idx} className="text-ink">{finding}</li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    {mode === "simple" ? "What To Do Next" : "Recommended Actions"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!hasData ? (
                    <p className="text-sm text-ink-muted">No actions required.</p>
                  ) : recommendedActions.length === 0 ? (
                    <p className="text-sm text-ink-muted">Generating recommended actions...</p>
                  ) : (
                    <ul className="list-disc pl-5 space-y-2 text-sm text-ink-muted">
                      {recommendedActions.map((action: string, idx: number) => (
                        <li key={idx} className="text-ink">{action}</li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        );
      }}
    </ResultsWrapper>
  );
}
