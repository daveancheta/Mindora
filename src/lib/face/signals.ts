export type MovementName = "smile-related movement detected" | "brow movement detected";
export type MovementSignals = MovementName[];
export type BlendshapeScore = { name: string; score: number };

/** Convert documented MediaPipe blendshape coefficients to cautious descriptions, never emotions. */
export function describeMovements(scores: BlendshapeScore[], previous: Record<string, number> = {}) {
  const smoothed: Record<string, number> = {};
  for (const item of scores) smoothed[item.name] = (previous[item.name] ?? item.score) * 0.68 + item.score * 0.32;
  const score = (name: string) => smoothed[name] ?? 0;
  const smile = Math.max(score("mouthSmileLeft"), score("mouthSmileRight"));
  const brow = Math.max(score("browDownLeft"), score("browDownRight"), score("browInnerUp"), score("browOuterUpLeft"), score("browOuterUpRight"));
  const signals: MovementSignals = [];
  if (smile >= 0.48) signals.push("smile-related movement detected");
  if (brow >= 0.48) signals.push("brow movement detected");
  return { signals, smoothed };
}

export function optionalSummary(signals: MovementSignals) {
  if (!signals.length) return "Facial movement signal is uncertain.";
  return signals.map((signal) => signal[0]?.toUpperCase() + signal.slice(1)).join("; ") + ".";
}
