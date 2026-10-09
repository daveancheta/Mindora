"use client";

import React, { useState } from "react";
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, RotateCcw } from "lucide-react";
import { usePrivateVault } from "@/components/private-vault";
import { PERSONALITY_DIMENSIONS, PERSONALITY_QUESTIONS, PERSONALITY_SCALE, PERSONALITY_TYPES, PERSONALITY_VERSION, scorePersonality, type Dimension } from "@/lib/personality/questionnaire";
import type { PersonalityDraft, PersonalityRun } from "@/lib/chat/types";

const now = () => new Date().toISOString();
const emptyDraft = (): PersonalityDraft => ({ version: PERSONALITY_VERSION, startedAt: now(), updatedAt: now(), answers: {} });
function displayDate(value: string) { return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }

export function PersonalityAssessment() {
  const { vault, save } = usePrivateVault();
  const [active, setActive] = useState(Boolean(vault.personalityDraft)); const [review, setReview] = useState(false); const [index, setIndex] = useState(0); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [comparisonId, setComparisonId] = useState("");
  const latest = vault.personalityRuns[0]; const [selectedId, setSelectedId] = useState(latest?.completedAt ?? "");
  const selected = vault.personalityRuns.find((run) => run.completedAt === selectedId) ?? latest;
  const draft = vault.personalityDraft;
  const answers = draft?.version === PERSONALITY_VERSION ? draft.answers : {};
  const current = PERSONALITY_QUESTIONS[index]; const answered = Object.keys(answers).length;

  async function saveDraft(next: PersonalityDraft | null) { setSaving(true); setError(""); try { await save({ ...vault, personalityDraft: next }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this assessment."); } finally { setSaving(false); } }
  async function start() { setIndex(0); setReview(false); setActive(true); await saveDraft(draft?.version === PERSONALITY_VERSION ? draft : emptyDraft()); }
  async function answer(value: number) {
    const base = draft?.version === PERSONALITY_VERSION ? draft : emptyDraft();
    await saveDraft({ ...base, updatedAt: now(), answers: { ...base.answers, [current!.id]: value } });
  }
  async function finish() {
    if (answered !== PERSONALITY_QUESTIONS.length) { setError("Answer every item before viewing your result."); setIndex(PERSONALITY_QUESTIONS.findIndex((question) => !(question.id in answers))); setReview(false); return; }
    try {
      const result = scorePersonality(answers); const completedAt = now();
      const run: PersonalityRun = { ...(draft ?? emptyDraft()), version: PERSONALITY_VERSION, completedAt, updatedAt: completedAt, result };
      setSaving(true); await save({ ...vault, personalityDraft: null, personalityRuns: [run, ...vault.personalityRuns].slice(0, 50) }); setSelectedId(completedAt); setActive(false); setReview(false); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this result."); }
    finally { setSaving(false); }
  }

  if (active || draft) {
    const compatible = draft?.version === PERSONALITY_VERSION;
    if (!compatible && draft) return <div className="card"><strong>Assessment version changed</strong><p className="smalltext muted">Your saved answers are kept in your encrypted vault. This version needs a new response set before scoring.</p><button className="button primary" onClick={() => void start()}>Start version {PERSONALITY_VERSION}</button></div>;
    if (review) return <div className="card assessment-card"><div className="card-head"><div><div className="card-title"><BookOpenCheck size={17}/> Review your answers</div><p className="smalltext muted">Select any item to change it. Your in-progress answers are saved in the encrypted vault.</p></div><span className="pill">{answered} / 60 answered</span></div><div className="answer-review">{PERSONALITY_QUESTIONS.map((question, questionIndex) => <button className="answer-review-row" key={question.id} onClick={() => { setIndex(questionIndex); setReview(false); }}><span><small>{questionIndex + 1} · {PERSONALITY_DIMENSIONS[question.dimension].name}</small><strong>{question.text}</strong></span><span className={answers[question.id] ? "answer-pill" : "answer-pill missing"}>{answers[question.id] ? PERSONALITY_SCALE[answers[question.id]! - 1]?.label : "Not answered"}</span></button>)}</div>{error && <p className="form-error">{error}</p>}<div className="row assessment-actions"><button className="button" onClick={() => setReview(false)}><ArrowLeft size={14}/> Back to item</button><button className="button primary" onClick={() => void finish()} disabled={saving || answered !== 60}><Check size={14}/> Calculate my reflection</button></div></div>;
    return <div className="card assessment-card"><div className="card-head"><div><div className="card-title"><BookOpenCheck size={17}/> Self-reflection · v1</div><p className="smalltext muted">Not a validated psychological instrument or a diagnosis. There are no right answers.</p></div><span className="pill">{index + 1} / 60</span></div><div className="progress"><i style={{ width: `${answered / PERSONALITY_QUESTIONS.length * 100}%` }}/></div><div className="assessment-question"><div className="eyebrow">{PERSONALITY_DIMENSIONS[current!.dimension].name}</div><h2>{current!.text}</h2></div><div className="likert-list" role="radiogroup" aria-label={`Response for item ${index + 1}`}>
      {PERSONALITY_SCALE.map((option) => <button type="button" role="radio" aria-checked={answers[current!.id] === option.value} className={`likert-option${answers[current!.id] === option.value ? " selected" : ""}`} key={option.value} onClick={() => void answer(option.value)}><span>{option.value}</span><small>{option.label}</small></button>)}
    </div>{saving && <span role="status" className="smalltext muted">Saving encrypted progress…</span>}{error && <p className="form-error">{error}</p>}<div className="row assessment-actions"><button className="button" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}><ArrowLeft size={14}/> Previous</button><button className="button" onClick={() => setReview(true)}>Review answers</button>{index < 59 ? <button className="button primary" disabled={!answers[current!.id]} onClick={() => setIndex((value) => Math.min(59, value + 1))}>Next <ArrowRight size={14}/></button> : <button className="button primary" disabled={answered !== 60} onClick={() => setReview(true)}>Review and finish <ArrowRight size={14}/></button>}</div></div>;
  }

  if (!selected) return <div className="card assessment-card"><div className="card-title"><BookOpenCheck size={17}/> A map of preferences</div><p className="smalltext muted">Explore four everyday preference dimensions through 60 original statements. Results describe the answers you gave today; they do not define you.</p><div className="empty"><strong>No completed reflections yet</strong>You can pause and resume at any time. Answers are encrypted in your local vault.</div><button className="button primary" onClick={() => void start()}>Start the 60-item reflection</button></div>;

  const typeInfo = PERSONALITY_TYPES[selected.result.type] ?? PERSONALITY_TYPES.ISTJ!;
  const previousRuns = vault.personalityRuns.filter((run) => run.completedAt !== selected.completedAt);
  const compared = previousRuns.find((run) => run.completedAt === comparisonId);
  return <div className="assessment-results">
    <section className="card result-hero"><div className="eyebrow">Illustrative preference pattern · {displayDate(selected.completedAt)}</div><div className="result-type">{selected.result.type}</div><h2>{typeInfo.title}</h2><p className="smalltext muted">{typeInfo.description}</p><div className="notice neutral">This is a self-reflection tool, not a validated personality test or mental-health diagnosis. Preferences can vary by setting, experience, and time.</div><div className="growth-prompt"><strong>A gentle growth prompt</strong><p>{typeInfo.growth}</p></div></section>
    <section className="card"><div className="card-title">Your four dimensions</div><div className="dimension-results">{(Object.keys(PERSONALITY_DIMENSIONS) as Dimension[]).map((dimension) => { const data = PERSONALITY_DIMENSIONS[dimension]; const left = selected.result.scores[dimension] ?? 50; const certainty = selected.result.uncertainty[dimension] ?? "balanced / still exploring"; return <div className="dimension-result" key={dimension}><div className="row"><strong>{data.left} · {data.name}</strong><span className="smalltext muted">{certainty}</span></div><div className="dimension-track"><i style={{ width: `${left}%` }}/><b/></div><div className="row dimension-poles"><span>{data.left} · {left}%</span><span>{data.right} · {100 - left}%</span></div></div>; })}</div></section>
    <section className="card"><div className="card-head"><div className="card-title">Compare with an earlier reflection</div><span className="smalltext muted">A comparison of your own answers, not a progress score</span></div>{previousRuns.length ? <><label className="field-label">Earlier result<select className="field-input" value={comparisonId} onChange={(event) => setComparisonId(event.target.value)}><option value="">Choose a date</option>{previousRuns.map((run) => <option value={run.completedAt} key={run.completedAt}>{PERSONALITY_TYPES[run.result.type]?.title ?? run.result.type} · {displayDate(run.completedAt)}</option>)}</select></label>{compared && <div className="comparison-grid">{(Object.keys(PERSONALITY_DIMENSIONS) as Dimension[]).map((dimension) => <div key={dimension}><small>{PERSONALITY_DIMENSIONS[dimension].name}</small><strong>{compared.result.scores[dimension]}% → {selected.result.scores[dimension]}%</strong><span>{compared.result.uncertainty[dimension]} → {selected.result.uncertainty[dimension]}</span></div>)}</div>}</> : <p className="smalltext muted">Complete another reflection later to compare how your answers differ. Change is not a measure of improvement.</p>}</section>
    <div className="row assessment-actions"><button className="button primary" onClick={() => void start()}><RotateCcw size={14}/> Retake</button>{vault.personalityRuns.length > 1 && <select className="field-input" value={selected.completedAt} onChange={(event) => setSelectedId(event.target.value)} aria-label="View a saved result">{vault.personalityRuns.map((run) => <option key={run.completedAt} value={run.completedAt}>{run.result.type} · {displayDate(run.completedAt)}</option>)}</select>}</div>
  </div>;
}

