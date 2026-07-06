/**
 * Shared scoring logic — mirrors the backend Vendor Scoring Agent's deterministic formula.
 * Used client-side for the What-if simulator so math is identical.
 */

export interface ScoringWeights {
  cost: number;
  security: number;
  support: number;
  warranty: number;
  delivery: number;
}

export interface VendorScores {
  cost: number;
  security: number;
  support: number;
  warranty: number;
  delivery: number;
}

export interface VendorScoreResult {
  vendor_name: string;
  scores: VendorScores;
  weighted_total: number;
  rank: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  cost: 30,
  security: 25,
  support: 20,
  warranty: 15,
  delivery: 10,
};

/**
 * Compute weighted total for a single vendor given raw scores and weights.
 * Weights are expected to sum to 100.
 */
export function computeWeightedTotal(
  scores: VendorScores,
  weights: ScoringWeights
): number {
  const total =
    (scores.cost * weights.cost +
      scores.security * weights.security +
      scores.support * weights.support +
      scores.warranty * weights.warranty +
      scores.delivery * weights.delivery) /
    100;
  return Math.round(total * 100) / 100;
}

/**
 * Re-rank all vendors using the given weights.
 * Returns a new array with updated weighted_total and rank fields.
 */
export function recomputeRankings(
  vendorScores: VendorScoreResult[],
  weights: ScoringWeights
): VendorScoreResult[] {
  const updated = vendorScores.map((v) => ({
    ...v,
    weighted_total: computeWeightedTotal(v.scores, weights),
  }));

  // Sort descending by weighted_total
  updated.sort((a, b) => b.weighted_total - a.weighted_total);

  // Assign ranks
  return updated.map((v, i) => ({
    ...v,
    rank: i + 1,
  }));
}

/**
 * Normalize weights so they always sum to 100.
 * When a slider moves, redistribute the difference proportionally among the others.
 */
export function normalizeWeights(
  weights: ScoringWeights,
  changedKey: keyof ScoringWeights,
  newValue: number
): ScoringWeights {
  const keys = Object.keys(weights) as (keyof ScoringWeights)[];
  const otherKeys = keys.filter((k) => k !== changedKey);
  const oldOtherSum = otherKeys.reduce((sum, k) => sum + weights[k], 0);
  const remaining = 100 - newValue;

  const result: ScoringWeights = { ...weights, [changedKey]: newValue };

  if (oldOtherSum === 0) {
    // Edge case: all other weights are 0 — distribute equally
    const each = remaining / otherKeys.length;
    otherKeys.forEach((k) => {
      result[k] = Math.round(each);
    });
  } else {
    // Proportionally redistribute
    let allocated = 0;
    otherKeys.forEach((k, i) => {
      if (i === otherKeys.length - 1) {
        // Last key gets the remainder to avoid rounding errors
        result[k] = Math.max(0, remaining - allocated);
      } else {
        const proportion = weights[k] / oldOtherSum;
        const val = Math.max(0, Math.round(remaining * proportion));
        result[k] = val;
        allocated += val;
      }
    });
  }

  return result;
}
