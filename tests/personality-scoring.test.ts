import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PERSONALITY_DIMENSIONS, PERSONALITY_QUESTIONS, PERSONALITY_VERSION, scorePersonality, type Dimension, type PreferenceLetter } from "@/lib/personality/questionnaire";

const opposite: Record<PreferenceLetter, PreferenceLetter> = { E: "I", I: "E", S: "N", N: "S", T: "F", F: "T", J: "P", P: "J" };
const neutral = () => Object.fromEntries(PERSONALITY_QUESTIONS.map((question) => [question.id, 3]));

describe("versioned four-dimension questionnaire scoring", () => {
  it("has exactly 60 uniquely identified items in the current version", () => {
    assert.equal(PERSONALITY_VERSION, "mindspace-preferences-60-v1");
    assert.equal(PERSONALITY_QUESTIONS.length, 60);
    assert.equal(new Set(PERSONALITY_QUESTIONS.map((question) => question.id)).size, 60);
  });

  for (const [dimension, ends] of Object.entries(PERSONALITY_DIMENSIONS) as [Dimension, (typeof PERSONALITY_DIMENSIONS)[Dimension]][]) {
    it(`${dimension} answers score in both preference directions`, () => {
      const leftAnswers = neutral(); const rightAnswers = neutral();
      for (const question of PERSONALITY_QUESTIONS.filter((item) => item.dimension === dimension)) {
        const effective = question.reverse ? opposite[question.toward] : question.toward;
        leftAnswers[question.id] = effective === ends.left ? 5 : 1;
        rightAnswers[question.id] = effective === ends.right ? 5 : 1;
      }
      assert.equal(scorePersonality(leftAnswers).scores[dimension], 100);
      assert.equal(scorePersonality(rightAnswers).scores[dimension], 0);
      assert.equal(scorePersonality(leftAnswers).type[Object.keys(PERSONALITY_DIMENSIONS).indexOf(dimension)], ends.left);
      assert.equal(scorePersonality(rightAnswers).type[Object.keys(PERSONALITY_DIMENSIONS).indexOf(dimension)], ends.right);
    });

    it(`${dimension} reverse-keyed questions invert agree/disagree correctly`, () => {
      const reverseQuestion = PERSONALITY_QUESTIONS.find((item) => item.dimension === dimension && item.reverse)!;
      const answers = neutral(); answers[reverseQuestion.id] = 5;
      const result = scorePersonality(answers);
      const effective = opposite[reverseQuestion.toward];
      assert.ok(effective === ends.left ? result.scores[dimension] > 50 : result.scores[dimension] < 50);
    });

    it(`${dimension} neutral answers remain balanced and marked uncertain`, () => {
      const result = scorePersonality(neutral());
      assert.equal(result.scores[dimension], 50);
      assert.equal(result.uncertainty[dimension], "balanced / still exploring");
    });
  }

  it("supports all 16 four-letter combinations without LLM scoring", () => {
    const types = new Set<string>();
    const letterIndex: Record<Dimension, number> = { EI: 0, SN: 1, TF: 2, JP: 3 };
    for (const ei of ["E", "I"] as const) for (const sn of ["S", "N"] as const) for (const tf of ["T", "F"] as const) for (const jp of ["J", "P"] as const) {
      const desired = `${ei}${sn}${tf}${jp}`; const answers = neutral();
      for (const question of PERSONALITY_QUESTIONS) {
        const effective = question.reverse ? opposite[question.toward] : question.toward;
        answers[question.id] = effective === desired[letterIndex[question.dimension]] ? 5 : 1;
      }
      const actual = scorePersonality(answers).type; types.add(actual);
      assert.equal(actual.length, 4);
    }
    assert.equal(types.size, 16);
  });

  it("rejects missing or out-of-scale responses", () => {
    assert.throws(() => scorePersonality({}), /Answer every question/);
    const invalid = neutral(); invalid[PERSONALITY_QUESTIONS[0]!.id] = 7;
    assert.throws(() => scorePersonality(invalid), /Answer every question/);
  });
});

