import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import {
  type Draft,
  digest,
  type Finding,
  type Observation,
  type ReadRecord,
  type Suggestion,
  suggestionDigest,
} from "./records";
import { readRepository } from "./repository";

export const readRecordGroups = async (ctx: ExtensionContextBase) => {
  const records = (await ctx.storage.records.list()).filter((record) => !record.deleted);
  const values = <T>(kind: string) =>
    records
      .filter((record) => (record.value as unknown as { kind: string }).kind === kind)
      .map((record) => (record.value as unknown as { value: T }).value);
  return {
    suggestions: values<Suggestion>("suggestion"),
    observations: values<Observation>("observation"),
    findings: values<Finding>("finding"),
    reads: values<ReadRecord>("read"),
    drafts: values<Draft>("draft"),
  };
};

// Native navigation needs current identities and counts, not evidence fingerprints or workspace controls.
export const readIndex = async (ctx: ExtensionContextBase) => {
  const [snapshot, records] = await Promise.all([readRepository(ctx), readRecordGroups(ctx)]);
  const suggestions = records.suggestions.filter((item) => item.workspaceId === snapshot.workspaceId);
  const observations = records.observations.filter((item) => item.workspaceId === snapshot.workspaceId);
  const findings = records.findings.filter((item) => item.workspaceId === snapshot.workspaceId);
  const unread = (id: string, valueDigest: string) =>
    !records.reads.some((read) => read.id === id && read.digest === valueDigest);
  const rules = snapshot.book?.rules ?? [];
  return {
    chapters: snapshot.book?.chapters ?? [],
    rules,
    suggestions,
    observations,
    findings,
    counts: {
      Findings: findings.filter((item) => !item.resolved && unread(item.id, digest(item))).length,
      Undocumented: observations.filter(
        (item) =>
          !item.requirements.some((ref) => rules.some((rule) => rule.ref === ref)) && unread(item.id, digest(item)),
      ).length,
      Suggestions: suggestions.filter((item) => unread(item.id, suggestionDigest(item))).length,
    },
  };
};
