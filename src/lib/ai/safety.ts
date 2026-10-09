/** Deterministic first-pass safety routing, independent of model output. It never diagnoses. */
const immediateDanger = /\b(?:going to|about to|will|plan(?:ning)? to|tonight|right now|today)\b.{0,50}\b(?:kill myself|end my life|hurt myself|take my life|suicide|shoot (?:him|her|them|myself)|kill (?:him|her|them|someone)|hurt (?:him|her|them|someone))\b|\b(?:overdose(?:d)?|already took (?:the )?(?:pills|tablets)|can't stay safe|cannot stay safe|have a weapon)\b/i;
const recentOverdose = /\b(?:(?:i|i've|i have)\s+)?(?:just\s+)?(?:took|taken|swallowed|ingested|overdosed)\b.{0,80}\b(?:pills?|tablets?|meds?|medication|drugs?|poison|overdose)\b/i;
const immediateThreat = /\b(?:someone|he|she|they|my partner|my parent|my roommate)\s+(?:is|are)\s+(?:trying to (?:kill|hurt)|attacking|hitting|strangling|threatening)\s+me\b/i;
const selfHarmConcern = /\b(?:suicid(?:e|al)|overdos(?:e|ing)|kill myself|end my life|self[- ]harm|hurt myself|don't want to live|do not want to live|wish i (?:was|were) dead)\b/i;
const harmConcern = /\b(?:want to|going to|plan to|might|will) (?:kill|hurt|attack|stab|shoot) (?:him|her|them|someone|myself)\b/i;
export type SafetyResult = { level: "urgent" | "concern"; reply: string } | null;
export function checkSafety(text: string): SafetyResult {
  if (immediateDanger.test(text) || recentOverdose.test(text) || immediateThreat.test(text)) return { level: "urgent", reply: "I'm really sorry this feels so intense. I can't contact anyone for you, but if you might act on this or are in immediate danger, please call your local emergency number now or go to the nearest emergency department. If you can, move near someone you trust and tell them plainly that you need support. Are you somewhere safe right now?" };
  if (selfHarmConcern.test(text) || harmConcern.test(text)) return { level: "concern", reply: "I'm glad you told me. I can't assess your safety from here, but you deserve support from a real person too. If you may be in immediate danger, call your local emergency number or go to an emergency department. Otherwise, could you reach out to someone you trust or a qualified mental health professional today?" };
  return null;
}
