"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function MLControlCenterPage() {
  const { session, isAdmin, isLoading: authLoading } = useAuth();
  
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);
  const [forceRetrain, setForceRetrain] = useState(false);
  const [retrainResult, setRetrainResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadStatus = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiFetch("/ml/status");
      setStatus(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to load ML model status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAdmin) {
      loadStatus();
    }
  }, [authLoading, isAdmin]);

  const handleRetrain = async () => {
    setRetraining(true);
    setRetrainResult(null);
    setErrorMsg(null);
    try {
      const data = await apiFetch(`/ml/retrain?force=${forceRetrain}`, {
        method: "POST"
      });
      setRetrainResult(data);
      await loadStatus();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Retraining failed.");
    } finally {
      setRetraining(false);
    }
  };

  if (authLoading || (loading && !status && isAdmin)) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-6 h-6 border-2 border-navy border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Frontend gating
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4 max-w-2xl mx-auto text-center">
        <div className="text-audit-red text-6xl font-serif font-bold">403</div>
        <h2 className="font-serif text-2xl font-semibold text-ink">Access Denied</h2>
        <p className="text-ink-muted text-sm leading-relaxed">
          You do not have the required administrative permissions to access the Machine Learning Model Control Center. This interface and its associated endpoints are restricted to platform super-admins.
        </p>
      </div>
    );
  }

  const realCount = status?.real_outcomes_count ?? 0;
  const threshold = status?.threshold ?? 50;
  const progressPercent = Math.min(100, (realCount / threshold) * 100);

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-ink mb-2">
          ML Model Control Center
        </h1>
        <p className="text-ink-muted">
          Manage the platform-wide cold-start synthetic baseline and supervise retraining transitions based on aggregate customer outcomes.
        </p>
      </div>

      <div className="bg-navy/5 border border-navy/20 p-4 rounded text-sm text-ink-muted leading-relaxed">
        <strong className="text-navy">Platform-wide Aggregated Data:</strong> This control center monitors ML health parameters across the entire system. No individual company names, specific customer project identities, or raw vendor proposals are ever exposed. All metrics represent system-wide aggregates.
      </div>

      {errorMsg && (
        <div className="p-4 bg-audit-red/5 border border-audit-red/20 text-audit-red text-sm rounded-md">
          {errorMsg}
        </div>
      )}

      {/* Progress Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 border border-rule rounded-md bg-surface p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-2">
              Platform-Wide Real Outcomes Logged (Aggregate)
            </h3>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-serif font-bold text-ink">{realCount}</span>
              <span className="text-sm text-ink-muted">/ {threshold} required for production retraining</span>
            </div>
            
            {/* Custom progress bar */}
            <div className="w-full bg-neutral-100 rounded-full h-3 mb-2 overflow-hidden border border-rule">
              <div 
                className="bg-navy h-full transition-all duration-500" 
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
          
          <p className="text-xs text-ink-muted mt-2">
            This count represents real-world outcomes logged by <em className="underline">all customer accounts</em> on the platform. It is expected to remain at or near 0 until other customer organizations are active. Retraining with real data will only run when this aggregate count reaches the target threshold.
          </p>
        </div>

        {/* Action Panel */}
        <div className="border border-rule rounded-md bg-surface p-6 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
            Model Retraining Actions
          </h3>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="force-retrain-chk"
              checked={forceRetrain}
              onChange={(e) => setForceRetrain(e.target.checked)}
              className="text-navy focus:ring-navy"
            />
            <label htmlFor="force-retrain-chk" className="text-xs text-ink select-none cursor-pointer">
              Force retrain (ignore threshold)
            </label>
          </div>

          <Button 
            onClick={handleRetrain} 
            disabled={retraining} 
            className="w-full"
          >
            {retraining ? "Running Retraining..." : "Retrain Models"}
          </Button>

          {retrainResult && (
            <div className={`p-3 text-xs rounded-md border ${
              retrainResult.status === "success" 
                ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}>
              <div className="font-semibold mb-1">
                {retrainResult.status === "success" ? "Retraining Succeeded" : "Retraining Skipped"}
              </div>
              <div>{retrainResult.message}</div>
            </div>
          )}
        </div>
      </div>

      {/* Model Registry Table */}
      <div className="space-y-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-ink mb-1">
            Global Model Registry
          </h2>
          <p className="text-sm text-ink-muted">
            Full audit log of active and historical model weights registered in the system.
          </p>
        </div>

        <div className="border border-rule rounded-md overflow-hidden bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Training Size</TableHead>
                <TableHead>Late Delivery AUC / Acc</TableHead>
                <TableHead>Hidden Costs AUC / Acc</TableHead>
                <TableHead>Risk realized MAE</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Trained At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!status?.registry || status.registry.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-ink-muted">
                    No models registered yet.
                  </TableCell>
                </TableRow>
              ) : (
                status.registry.map((m: any) => {
                  const val = m.validation_metrics || {};
                  const lateAuc = val.late_delivery?.auc ?? 0;
                  const lateAcc = val.late_delivery?.accuracy ?? 0;
                  const hiddenAuc = val.hidden_costs?.auc ?? 0;
                  const hiddenAcc = val.hidden_costs?.accuracy ?? 0;
                  const riskMae = val.risk_realized?.mae ?? 0;

                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono font-medium text-ink">
                        {m.version}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {m.training_data_size} rows
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {lateAuc.toFixed(2)} / {lateAcc.toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {hiddenAuc.toFixed(2)} / {hiddenAcc.toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {riskMae.toFixed(3)}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          m.is_active 
                            ? "bg-navy/10 text-navy" 
                            : "bg-neutral-100 text-ink-muted"
                        }`}>
                          {m.is_active ? "Active" : "Historical"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-ink-muted">
                        {m.trained_at ? new Date(m.trained_at).toLocaleString() : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
