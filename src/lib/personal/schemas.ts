import { z } from "zod";

export const journalEntrySchema = z.object({
  id: z.string().min(1).max(80), title: z.string().max(120), content: z.string().max(30_000),
  tags: z.array(z.string().trim().min(1).max(32)).max(12), createdAt: z.string().datetime(), updatedAt: z.string().datetime(), archived: z.boolean(),
}).strict();
export const moodEntrySchema = z.object({
  id: z.string().min(1).max(80), date: z.iso.date(), label: z.string().trim().min(1).max(40),
  energy: z.number().int().min(1).max(5), stress: z.number().int().min(1).max(5), note: z.string().max(1200),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
}).strict();
export const personalityDraftSchema = z.object({ version: z.string().min(1).max(60), startedAt: z.string().datetime(), updatedAt: z.string().datetime(), answers: z.record(z.string(), z.number().int().min(1).max(5)) }).strict();
export const personalityRunSchema = personalityDraftSchema.extend({ completedAt: z.string().datetime(), result: z.object({ type: z.string().length(4), scores: z.record(z.string(), z.number().min(0).max(100)), uncertainty: z.record(z.string(), z.string()) }).strict() });
const messageSchema = z.object({ id: z.string().min(1).max(80), role: z.enum(["user", "assistant"]), content: z.string().max(100_000), createdAt: z.string().datetime(), error: z.string().max(500).optional() }).strict();
const conversationSchema = z.object({ id: z.string().min(1).max(80), title: z.string().max(160), createdAt: z.string().datetime(), updatedAt: z.string().datetime(), messages: z.array(messageSchema).max(2000) }).strict();
const memorySchema = z.object({ id: z.string().min(1).max(80), text: z.string().min(1).max(400), updatedAt: z.string().datetime() }).strict();
export const vaultBackupSchema = z.object({ conversations: z.array(conversationSchema).max(1000), memories: z.array(memorySchema).max(500), memoryEnabled: z.boolean(), journalEntries: z.array(journalEntrySchema).max(1000), moodEntries: z.array(moodEntrySchema).max(1000), personalityDraft: personalityDraftSchema.nullable(), personalityRuns: z.array(personalityRunSchema).max(100) }).strict();
