"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProject } from "@/lib/project";
import { apiFetch } from "@/lib/api";
import {
  ScoringWeights,
  VendorScoreResult,
  DEFAULT_WEIGHTS,
  recomputeRankings,
  normalizeWeights,
} from "@/lib/scoring";
interface WeightSimulatorProps {
  recommendation: {
    weights_used?: ScoringWeights;
    vendor_scores?: VendorScoreResult[];
  } | null;
}

const CRITERIA_LABELS: Record<keyof ScoringWeights, string> = {
  cost: "Cost",
  security: "Security",
  support: "Support",
  warranty: "Warranty",
  delivery: "Delivery",
};

export function WeightSimulator({ recommendation }: WeightSimulatorProps) {
  const { currentProject } = useProject();
  
  const originalWeights = useMemo<ScoringWeights>(() => {
    return recommendation?.weights_used || DEFAULT_WEIGHTS;
  }, [recommendation?.weights_used]);

  const vendorScores = useMemo<VendorScoreResult[]>(() => {
    return recommendation?.vendor_scores || [];
  }, [recommendation?.vendor_scores]);

  const [weights, setWeights] = useState<ScoringWeights>({ ...originalWeights });
  const [saving, setSaving] = useState(false);

  // Recompute rankings live as weights change
  const adjustedScores = useMemo(
    () => recomputeRankings(vendorScores, weights),
    [vendorScores, weights]
  );

  const originalScores = useMemo(
    () => recomputeRankings(vendorScores, originalWeights),
    [vendorScores, originalWeights]
  );

  const hasChanges = JSON.stringify(weights) !== JSON.stringify(originalWeights);

  const handleWeightChange = (key: keyof ScoringWeights, value: number) => {
    setWeights(normalizeWeights(weights, key, value));
  };

  const handleReset = () => {
    setWeights({ ...originalWeights });
  };

  const handleSaveAndRerun = async () => {
    if (!currentProject) return;
    setSaving(true);
    try {
      await apiFetch(`/projects/${currentProject.id}/weights`, {
        method: "POST",
        body: JSON.stringify(weights),
      });
      await apiFetch(`/projects/${currentProject.id}/run`, { method: "POST" });
      window.dispatchEvent(new CustomEvent("refresh-results"));
    } catch (e: unknown) {
      alert(`Failed to save: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  if (vendorScores.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Adjust Scoring Weights</CardTitle>
          <div className="flex gap-2">
            {hasChanges && (
              <Button variant="secondary" size="sm" onClick={handleReset}>
                Reset
              </Button>
            )}
            {hasChanges && (
              <Button
                size="sm"
                onClick={handleSaveAndRerun}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save & Re-run Full Analysis"}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Weight Sliders */}
        <div className="space-y-3 mb-6">
          {(Object.keys(CRITERIA_LABELS) as (keyof ScoringWeights)[]).map(
            (key) => (
              <div key={key} className="flex items-center gap-3">
                <span className="w-20 text-sm font-medium text-ink">
                  {CRITERIA_LABELS[key]}
                </span>
                <input
                  type="range"
                  min={0}
                  max={80}
                  value={weights[key]}
                  onChange={(e) =>
                    handleWeightChange(key, parseInt(e.target.value))
                  }
                  className="flex-1 h-1.5 accent-navy cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #1D3557 0%, #1D3557 ${
                      (weights[key] / 80) * 100
                    }%, #DAD5C8 ${(weights[key] / 80) * 100}%, #DAD5C8 100%)`,
                  }}
                />
                <span className="w-10 text-right font-mono text-sm tabular-nums text-ink">
                  {weights[key]}%
                </span>
              </div>
            )
          )}
        </div>

        {/* Rankings Comparison */}
        <div className="grid grid-cols-2 gap-6">
          {/* Original Ranking */}
          <div>
            <h4 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
              Original Ranking
            </h4>
            <div className="space-y-2">
              {originalScores.map((v) => (
                <div
                  key={v.vendor_name}
                  className="flex items-center gap-3 p-2 rounded-sm bg-paper"
                >
                  <span className="w-5 h-5 rounded-full bg-navy text-surface text-xs font-medium flex items-center justify-center font-mono">
                    {v.rank}
                  </span>
                  <span className="flex-1 text-sm font-medium text-ink truncate">
                    {v.vendor_name}
                  </span>
                  <span className="font-mono text-sm tabular-nums text-ink">
                    {v.weighted_total.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Live Adjusted Ranking */}
          <div>
            <h4 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
              {hasChanges ? "Adjusted Ranking" : "Current Ranking"}
            </h4>
            <div className="space-y-2">
              {adjustedScores.map((v) => {
                const originalRank =
                  originalScores.find((o) => o.vendor_name === v.vendor_name)
                    ?.rank || 0;
                const rankChange = originalRank - v.rank;
                return (
                  <div
                    key={v.vendor_name}
                    className={`flex items-center gap-3 p-2 rounded-sm transition-colors ${
                      hasChanges && rankChange !== 0
                        ? "bg-navy/5 border border-navy/10"
                        : "bg-paper"
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-navy text-surface text-xs font-medium flex items-center justify-center font-mono">
                      {v.rank}
                    </span>
                    <span className="flex-1 text-sm font-medium text-ink truncate">
                      {v.vendor_name}
                    </span>
                    <span className="font-mono text-sm tabular-nums text-ink">
                      {v.weighted_total.toFixed(1)}
                    </span>
                    {hasChanges && rankChange > 0 && (
                      <span className="text-verdigris text-xs font-medium">
                        ↑{rankChange}
                      </span>
                    )}
                    {hasChanges && rankChange < 0 && (
                      <span className="text-audit-red text-xs font-medium">
                        ↓{Math.abs(rankChange)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
