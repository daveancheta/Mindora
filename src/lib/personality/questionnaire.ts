export const PERSONALITY_VERSION = "mindspace-preferences-60-v1";
export const PERSONALITY_SCALE = [
  { value: 1, label: "Strongly disagree" }, { value: 2, label: "Somewhat disagree" },
  { value: 3, label: "Not sure / mixed" }, { value: 4, label: "Somewhat agree" }, { value: 5, label: "Strongly agree" },
] as const;
export type Dimension = "EI" | "SN" | "TF" | "JP";
export type PreferenceLetter = "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";
export type Question = { id: string; dimension: Dimension; toward: PreferenceLetter; reverse: boolean; text: string };
const make = (dimension: Dimension, rows: [PreferenceLetter, boolean, string][]): Question[] => rows.map(([toward, reverse, text], index) => ({ id: `${dimension.toLowerCase()}-${String(index + 1).padStart(2, "0")}`, dimension, toward, reverse, text }));
const questions: Question[] = [
  ...make("EI", [
    ["E", false, "After a busy day, I often feel restored by a relaxed conversation."], ["I", false, "I usually like a little quiet time before I share a new idea."], ["E", true, "I tend to keep my thoughts to myself even when I feel ready to join in."], ["I", true, "Long stretches of quiet rarely help me feel recharged."], ["E", false, "Talking through a plan helps me notice what I think."], ["I", false, "I prefer to take in a room before choosing where to join."], ["E", true, "I usually wait for someone else to open a conversation."], ["I", true, "I rarely need private time to sort through a decision."], ["E", false, "I enjoy lively group activities when I have a choice."], ["I", false, "I often find one-to-one conversations more comfortable than a large group."], ["E", true, "I usually wait for others to begin talking at a gathering."], ["I", true, "I think best when I explain my thoughts aloud to someone."], ["E", false, "Sharing a first draft of an idea can help me develop it."], ["I", false, "I like having a few interests I can enjoy on my own."], ["E", true, "Group discussion rarely gives me energy or new ideas."],
  ]),
  ...make("SN", [
    ["S", false, "I trust details I can check before drawing a broad conclusion."], ["N", false, "I naturally look for a pattern that could connect separate details."], ["S", true, "A clear example is less useful to me than an abstract possibility."], ["N", true, "I am usually satisfied with the literal facts and do not look for a wider pattern."], ["S", false, "I like instructions that show what to do one step at a time."], ["N", false, "I enjoy imagining how a familiar idea might be used in a new way."], ["S", true, "I notice broad possibilities before I turn to practical details."], ["N", true, "I prefer to focus on what is immediately in front of me rather than future possibilities."], ["S", false, "I learn well when I can try a concrete example."], ["N", false, "Connections between topics interest me, even before they are useful."], ["S", true, "I am more interested in a theory than in how it works in practice."], ["N", true, "I rarely think about what an experience might mean in the long run."], ["S", false, "I remember specific moments and details from an experience."], ["N", false, "I enjoy finding an unusual angle on a familiar subject."], ["S", true, "A step-by-step account often feels less engaging than a conceptual overview."],
  ]),
  ...make("TF", [
    ["T", false, "When choosing between options, I first compare their strengths and trade-offs."], ["F", false, "I notice how a decision may affect the people involved."], ["T", true, "I set aside consistency when a choice feels personally meaningful."], ["F", true, "I rarely consider how a decision might land with someone else."], ["T", false, "I appreciate feedback that is direct and specific."], ["F", false, "I try to understand what matters to someone before offering advice."], ["T", true, "Clear criteria matter less to me than keeping everyone comfortable."], ["F", true, "I find it easy to stay detached from another person's point of view."], ["T", false, "In a disagreement, I want to understand what each person means."], ["F", false, "I value kindness even when a difficult truth needs to be said."], ["T", true, "A fair process is less important to me than avoiding discomfort."], ["F", true, "I can make a sound choice without first checking how it fits my personal values."], ["T", false, "I like to separate a problem into parts before solving it."], ["F", false, "I often weigh the human context as much as the practical result."], ["T", true, "I prefer a personal impression over a reason I can explain."],
  ]),
  ...make("JP", [
    ["J", false, "Having a rough plan makes a busy week easier for me."], ["P", false, "I like leaving some room for a new option to appear."], ["J", true, "I prefer to decide my approach only when a deadline is close."], ["P", true, "I feel uncomfortable changing a plan once it is made."], ["J", false, "I enjoy finishing one task before I start another."], ["P", false, "I can work comfortably while a few possibilities remain open."], ["J", true, "I usually keep my tasks unplanned until the last moment."], ["P", true, "A set routine usually feels more freeing than restrictive to me."], ["J", false, "I like knowing the main steps before beginning a project."], ["P", false, "I sometimes discover a better direction by exploring as I go."], ["J", true, "I would rather keep a decision open than settle on a clear choice."], ["P", true, "I naturally make lists and schedules for most parts of my day."], ["J", false, "Completing an unfinished task gives me a sense of relief."], ["P", false, "An unexpected change can make a day more interesting."], ["J", true, "I feel little need to organize upcoming responsibilities."],
  ]),
];

export const PERSONALITY_QUESTIONS = questions;
export const PERSONALITY_DIMENSIONS: Record<Dimension, { left: PreferenceLetter; right: PreferenceLetter; name: string }> = {
  EI: { left: "E", right: "I", name: "Social energy" }, SN: { left: "S", right: "N", name: "Information style" },
  TF: { left: "T", right: "F", name: "Decision focus" }, JP: { left: "J", right: "P", name: "Approach to plans" },
};
export type PersonalityResult = { type: string; scores: Record<Dimension, number>; uncertainty: Record<Dimension, "balanced / still exploring" | "some preference" | "clearer preference"> };
const other: Record<PreferenceLetter, PreferenceLetter> = { E: "I", I: "E", S: "N", N: "S", T: "F", F: "T", J: "P", P: "J" };
export function scorePersonality(answers: Record<string, number>): PersonalityResult {
  if (PERSONALITY_QUESTIONS.some((question) => !Number.isInteger(answers[question.id]) || answers[question.id]! < 1 || answers[question.id]! > 5)) throw new Error("Answer every question on the five-point scale before scoring.");
  const totals: Record<Dimension, number> = { EI: 0, SN: 0, TF: 0, JP: 0 };
  const counts: Record<Dimension, number> = { EI: 0, SN: 0, TF: 0, JP: 0 };
  for (const question of PERSONALITY_QUESTIONS) {
    const effective = question.reverse ? other[question.toward] : question.toward;
    const signed = answers[question.id]! - 3;
    totals[question.dimension] += effective === PERSONALITY_DIMENSIONS[question.dimension].left ? signed : -signed;
    counts[question.dimension] += 1;
  }
  const scores = {} as Record<Dimension, number>; const uncertainty = {} as PersonalityResult["uncertainty"]; let type = "";
  for (const dimension of Object.keys(PERSONALITY_DIMENSIONS) as Dimension[]) {
    const raw = totals[dimension]; const max = counts[dimension] * 2;
    scores[dimension] = Math.round(50 + (raw / max) * 50);
    type += raw >= 0 ? PERSONALITY_DIMENSIONS[dimension].left : PERSONALITY_DIMENSIONS[dimension].right;
    uncertainty[dimension] = Math.abs(raw) <= 4 ? "balanced / still exploring" : Math.abs(raw) <= 12 ? "some preference" : "clearer preference";
  }
  return { type, scores, uncertainty };
}

export const PERSONALITY_TYPES: Record<string, { title: string; description: string; growth: string }> = {
  ISTJ: { title: "Steady organizer", description: "You may value dependable methods, careful details, reasoned choices, and clear commitments. You often help make plans tangible.", growth: "Try leaving one small part of a plan open to new information." },
  ISFJ: { title: "Careful steward", description: "You may notice practical needs and personal context, then offer thoughtful follow-through. Familiar routines can provide a useful anchor.", growth: "Check whether a commitment still fits your own energy and priorities." },
  INFJ: { title: "Purpose finder", description: "You may connect patterns with personal meaning and prefer decisions that feel considered. Quiet reflection can help you find direction.", growth: "Turn one broad hope into a small, testable next step." },
  INTJ: { title: "Systems planner", description: "You may enjoy tracing ideas into long-range plans and improving how a process works. Independence and clear reasoning may matter to you.", growth: "Invite someone else's practical experience before locking in a solution." },
  ISTP: { title: "Hands-on solver", description: "You may prefer to understand how things work by testing them. Flexible problem-solving and calm analysis can be useful strengths.", growth: "Share your reasoning while a project is still in progress." },
  ISFP: { title: "Values-led maker", description: "You may respond to what is happening now while keeping personal meaning close. A gentle, hands-on approach can let your ideas take shape.", growth: "Give a valued project a light structure so it has room to continue." },
  INFP: { title: "Possibility keeper", description: "You may be drawn to ideas that fit your values and to stories about what could be. Space to reflect can help you find an authentic direction.", growth: "Choose one possibility and give it a modest first experiment." },
  INTP: { title: "Concept explorer", description: "You may enjoy examining ideas from several angles and finding an underlying explanation. Open questions can be energizing.", growth: "Decide what would count as enough evidence to move forward." },
  ESTP: { title: "Active improvisor", description: "You may notice immediate openings and learn by responding to what is happening. A practical next move can feel more useful than a long forecast.", growth: "Pause briefly to consider who else may be affected by a quick choice." },
  ESFP: { title: "Responsive connector", description: "You may bring attention to people and experiences in the present moment. Shared activity and flexible plans can suit your way of exploring.", growth: "Save a little quiet time for your own longer-term priorities." },
  ENFP: { title: "Idea catalyst", description: "You may enjoy connecting people, interests, and new possibilities. A sense of meaning can help you choose which ideas deserve your time.", growth: "Pick one promising idea and stay with it through a simple routine." },
  ENTP: { title: "Curious challenger", description: "You may spot alternate explanations and enjoy testing a familiar assumption. Conversation can help you refine an idea as it develops.", growth: "Notice when a useful idea is ready for a practical commitment." },
  ESTJ: { title: "Practical coordinator", description: "You may bring structure to shared work and value clear responsibilities. Observable progress can help a group stay oriented.", growth: "Ask how a different approach might work before settling the process." },
  ESFJ: { title: "Community builder", description: "You may combine awareness of concrete needs with care for the people involved. Clear plans can help you create a welcoming shared effort.", growth: "Make room for your own preferences alongside the group's needs." },
  ENFJ: { title: "People developer", description: "You may notice possibilities in people and connect them with a shared direction. Thoughtful encouragement can help a group coordinate.", growth: "Let others define their own next step instead of carrying the whole plan." },
  ENTJ: { title: "Strategic mobilizer", description: "You may connect broad aims to organized action and enjoy making a complex effort move. Clear priorities can help you focus energy.", growth: "Check how the pace and plan are working for the people alongside you." },
};
