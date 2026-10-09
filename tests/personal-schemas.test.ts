import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { journalEntrySchema, moodEntrySchema, vaultBackupSchema } from "@/lib/personal/schemas";

const journal={id:"j1",title:"A small entry",content:"Private note",tags:["today"],createdAt:"2026-10-10T00:00:00.000Z",updatedAt:"2026-10-10T00:00:00.000Z",archived:false};
const mood={id:"m1",date:"2026-10-10",label:"Okay",energy:3,stress:2,note:"",createdAt:"2026-10-10T00:00:00.000Z",updatedAt:"2026-10-10T00:00:00.000Z"};

describe("personal record validation",()=>{
  it("accepts valid local journal and mood records",()=>{assert.equal(journalEntrySchema.parse(journal).title,"A small entry");assert.equal(moodEntrySchema.parse(mood).energy,3);});
  it("rejects out of range mood ratings and unexpected fields",()=>{assert.equal(moodEntrySchema.safeParse({...mood,stress:8}).success,false);assert.equal(journalEntrySchema.safeParse({...journal,unexpected:"data"}).success,false);});
  it("rejects malformed or oversized backup arrays",()=>{assert.equal(vaultBackupSchema.safeParse({format:"mindspace-vault-backup-v1",conversations:[],memories:[],memoryEnabled:false,journalEntries:[{...journal,content:8}],moodEntries:[],personalityDraft:null,personalityRuns:[]}).success,false);});
});
