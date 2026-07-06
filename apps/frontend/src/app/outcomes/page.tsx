"use client";

import React, { useState, useEffect } from "react";
import { useProject } from "@/lib/project";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function LogOutcomePage() {
  const { currentProject } = useProject();
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [outcomes, setOutcomes] = useState<Record<string, any>>({});
  
  // Form fields
  const [deliveredOnTime, setDeliveredOnTime] = useState<boolean | null>(null);
  const [actualDeliveryDays, setActualDeliveryDays] = useState<number | "">("");
  const [hiddenCostsMaterialized, setHiddenCostsMaterialized] = useState<boolean | null>(null);
  const [actualTotalCost, setActualTotalCost] = useState<number | "">("");
  const [overallSatisfaction, setOverallSatisfaction] = useState<number>(3);
  const [notes, setNotes] = useState<string>("");
  
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load project results to get the vendors list
  useEffect(() => {
    if (!currentProject) return;
    
    const loadData = async () => {
      try {
        const results = await apiFetch(`/projects/${currentProject.id}/results`);
        const vList = results?.structured_proposal?.vendors || [];
        setVendors(vList);
        if (vList.length > 0) {
          setSelectedVendor(vList[0]);
        }
        
        // Fetch existing logged outcomes
        const logged = await apiFetch(`/projects/${currentProject.id}/outcomes`);
        const outcomesMap: Record<string, any> = {};
        (logged?.outcomes || []).forEach((o: any) => {
          outcomesMap[o.vendor_id] = o;
        });
        setOutcomes(outcomesMap);
      } catch (err) {
        console.error("Failed to load project vendors / outcomes:", err);
      }
    };
    
    loadData();
  }, [currentProject]);

  // Update form fields when selected vendor changes
  useEffect(() => {
    if (!selectedVendor) return;
    
    const existing = outcomes[selectedVendor.id];
    if (existing) {
      setDeliveredOnTime(existing.delivered_on_time);
      setActualDeliveryDays(existing.actual_delivery_days ?? "");
      setHiddenCostsMaterialized(existing.hidden_costs_materialized);
      setActualTotalCost(existing.actual_total_cost ?? "");
      setOverallSatisfaction(existing.overall_satisfaction ?? 3);
      setNotes(existing.notes ?? "");
    } else {
      setDeliveredOnTime(null);
      setActualDeliveryDays("");
      setHiddenCostsMaterialized(null);
      setActualTotalCost("");
      setOverallSatisfaction(3);
      setNotes("");
    }
    setSuccessMsg(null);
    setErrorMsg(null);
  }, [selectedVendor, outcomes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject || !selectedVendor) return;
    
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    
    const payload = {
      vendor_id: selectedVendor.id,
      delivered_on_time: deliveredOnTime,
      actual_delivery_days: actualDeliveryDays === "" ? null : Number(actualDeliveryDays),
      hidden_costs_materialized: hiddenCostsMaterialized,
      actual_total_cost: actualTotalCost === "" ? null : Number(actualTotalCost),
      overall_satisfaction: Number(overallSatisfaction),
      notes: notes,
      negotiation_asks_succeeded: {} // Can be extended if specific checklist is added
    };
    
    try {
      await apiFetch(`/projects/${currentProject.id}/outcomes`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      
      // Update local outcomes map
      setOutcomes({
        ...outcomes,
        [selectedVendor.id]: {
          ...payload,
          logged_at: new Date().toISOString()
        }
      });
      
      setSuccessMsg(`Successfully logged outcome details for ${selectedVendor.name}.`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to submit outcome details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-ink mb-2">
          Log Contract Outcomes
        </h1>
        <p className="text-ink-muted">
          Help build your procurement data moat. Log actual outcomes of active contracts to improve future machine learning predictions.
        </p>
      </div>

      {!currentProject ? (
        <div className="p-8 text-center text-ink-muted border border-rule rounded-md bg-surface">
          Select or create a workspace project to begin.
        </div>
      ) : vendors.length === 0 ? (
        <div className="p-8 text-center text-ink-muted border border-rule rounded-md bg-surface">
          No vendors found in this project. Please upload documents and run analysis first.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Vendor Selector list */}
          <div className="border border-rule rounded-md bg-surface p-4 space-y-4 h-fit">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
              Project Vendors
            </h3>
            <div className="space-y-2">
              {vendors.map((v) => {
                const isSelected = selectedVendor?.id === v.id;
                const hasLogged = !!outcomes[v.id];
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVendor(v)}
                    className={`w-full text-left px-3 py-2.5 rounded-md text-sm border transition-colors flex justify-between items-center ${
                      isSelected
                        ? "bg-navy/5 border-navy text-navy font-semibold"
                        : "bg-transparent border-transparent hover:bg-neutral-50 text-ink"
                    }`}
                  >
                    <span>{v.name}</span>
                    {hasLogged && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                        Logged
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Panel */}
          <div className="md:col-span-2 border border-rule rounded-md bg-surface p-6">
            {selectedVendor && (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <h3 className="font-serif text-xl font-semibold text-ink mb-1">
                    Log Outcome: {selectedVendor.name}
                  </h3>
                  <p className="text-xs text-ink-muted">
                    Category: {selectedVendor.category} | Annual Stated Spend: {selectedVendor.spend}
                  </p>
                </div>

                <div className="divider"></div>

                {successMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-md">
                    {successMsg}
                  </div>
                )}

                {errorMsg && (
                  <div className="p-3 bg-audit-red/5 border border-audit-red/20 text-audit-red text-sm rounded-md">
                    {errorMsg}
                  </div>
                )}

                {/* 1. Delivered on Time */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-ink">
                    Was the service/contract delivered on time?
                  </label>
                  <div className="flex gap-4">
                    {[
                      { label: "Yes, On Time", value: true },
                      { label: "No, Delayed", value: false },
                      { label: "Unknown / N/A", value: null }
                    ].map((opt) => (
                      <label key={String(opt.value)} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                        <input
                          type="radio"
                          name="deliveredOnTime"
                          checked={deliveredOnTime === opt.value}
                          onChange={() => setDeliveredOnTime(opt.value)}
                          className="text-navy focus:ring-navy"
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 2. Actual Delivery Days */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-ink">
                    Actual Delivery / Onboarding Lead Time (Days)
                  </label>
                  <input
                    type="number"
                    value={actualDeliveryDays}
                    onChange={(e) => setActualDeliveryDays(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="e.g. 15"
                    className="w-full max-w-xs border border-rule rounded px-3 py-2 text-sm bg-paper focus:ring-navy focus:border-navy"
                  />
                </div>

                {/* 3. Hidden Costs Materialized */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-ink">
                    Did any unexpected or hidden costs materialize during implementation?
                  </label>
                  <div className="flex gap-4">
                    {[
                      { label: "Yes, Materialized", value: true },
                      { label: "No, Match Budget", value: false },
                      { label: "Unknown / N/A", value: null }
                    ].map((opt) => (
                      <label key={String(opt.value)} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                        <input
                          type="radio"
                          name="hiddenCosts"
                          checked={hiddenCostsMaterialized === opt.value}
                          onChange={() => setHiddenCostsMaterialized(opt.value)}
                          className="text-navy focus:ring-navy"
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 4. Actual Total Cost */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-ink">
                    Actual Realized Cost (Stated Cost + Materialized Overages)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={actualTotalCost}
                    onChange={(e) => setActualTotalCost(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="e.g. 125000"
                    className="w-full max-w-xs border border-rule rounded px-3 py-2 text-sm bg-paper focus:ring-navy focus:border-navy"
                  />
                </div>

                {/* 5. Satisfaction */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-ink">
                    Overall Satisfaction Score (1 - 5)
                  </label>
                  <div className="flex gap-4">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <label key={val} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                        <input
                          type="radio"
                          name="satisfaction"
                          value={val}
                          checked={overallSatisfaction === val}
                          onChange={() => setOverallSatisfaction(val)}
                          className="text-navy focus:ring-navy"
                        />
                        <span>{val} Stars</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 6. Notes */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-ink">
                    Performance Notes & Realized Discrepancies
                  </label>
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Log details about vendor service delivery issues, invoice discrepancies, or compliance audits..."
                    className="w-full border border-rule rounded px-3 py-2 text-sm bg-paper focus:ring-navy focus:border-navy"
                  />
                </div>

                <div className="pt-4 border-t border-rule flex justify-end">
                  <Button type="submit" disabled={loading} className="w-40">
                    {loading ? "Saving..." : "Log Outcome"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
