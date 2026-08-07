export const MAX_COMPETITIVE_SCORE_PER_MATCH = 300;

export function calculateCompetitiveScore({
  won,
  kills,
  placement,
}: {
  won: boolean;
  kills: number;
  placement: number;
}) {
  const safeKills = Math.max(0, Math.min(10, Math.trunc(kills)));
  const safePlacement = Math.max(1, Math.min(6, Math.trunc(placement)));
  const survivalScore = Math.max(0, 35 - (safePlacement - 1) * 7);
  const score = (won ? 120 : 10) + survivalScore + safeKills * (won ? 20 : 10);
  return Math.min(MAX_COMPETITIVE_SCORE_PER_MATCH, score);
}
