import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { freshness } from "./checks";
import { type Book, operationIssues } from "./model";
import { readRecordGroups } from "./read-index";
import { digest, suggestionDigest } from "./records";
import { readRepository } from "./repository";

export const readBook = async (
  ctx: ExtensionContextBase,
  input: { workspaceId?: string; revision?: "working" | "accepted"; query?: string } = {},
) => {
  const snapshot = await readRepository(ctx, input.workspaceId, input.revision);
  const [workspaces, records] = await Promise.all([ctx.workspaces.list(), readRecordGroups(ctx)]);
  const { suggestions: allSuggestions, observations: allObservations, findings: allFindings, reads, drafts } = records;
  const suggestions = allSuggestions
    .filter((item) => item.workspaceId === snapshot.workspaceId)
    .map((item) => ({
      ...item,
      digest: suggestionDigest(item),
      issues:
        snapshot.book && !item.appliedRevision && item.application?.afterDigest !== snapshot.digest
          ? operationIssues(snapshot.book, item.operations)
          : [],
      reviewed: item.reviewedDigest === suggestionDigest(item),
      unread: !reads.some((read) => read.id === item.id && read.digest === suggestionDigest(item)),
    }));
  const observations = await Promise.all(
    allObservations
      .filter((item) => item.workspaceId === snapshot.workspaceId)
      .map(async (item) => ({
        ...item,
        requirements: item.requirements.filter((ref) => snapshot.book?.rules.some((rule) => rule.ref === ref)),
        retiredMappings: item.requirements.filter((ref) => !snapshot.book?.rules.some((rule) => rule.ref === ref)),
        ...(await freshness(ctx, snapshot.root, item)),
        unread: !reads.some((read) => read.id === item.id && read.digest === digest(item)),
      })),
  );
  const findings = allFindings
    .filter((item) => item.workspaceId === snapshot.workspaceId)
    .map((item) => ({ ...item, unread: !reads.some((read) => read.id === item.id && read.digest === digest(item)) }));
  const query = input.query?.trim().toLowerCase();
  const rules =
    snapshot.book?.rules.filter(
      (rule) => !query || `${rule.ref} ${rule.title} ${rule.statement}`.toLowerCase().includes(query),
    ) ?? [];
  return {
    workspaceId: snapshot.workspaceId,
    branch: snapshot.branch,
    target: snapshot.target,
    head: snapshot.head,
    revision: snapshot.revision,
    bookDigest: snapshot.digest,
    chapters: snapshot.book?.chapters ?? [],
    rules,
    retired: snapshot.book?.retired ?? [],
    exists: Boolean(snapshot.book),
    suggestions,
    observations,
    findings,
    drafts: drafts.filter((item) => item.workspaceId === snapshot.workspaceId),
    workspaces: workspaces
      .filter(
        (item) =>
          (item.executionKind ?? item.execution_kind) === "local" &&
          (item.providerState ?? item.provider_state) === "ready",
      )
      .map((item) => ({
        id: item.id,
        label: item.shorthand ?? item.workspace_shorthand ?? item.name ?? item.id,
        branch: item.branch,
        isDefault: item.isDefault ?? item.is_default,
      })),
    counts: {
      Findings: findings.filter((item) => !item.resolved && item.unread).length,
      Undocumented: observations.filter((item) => !item.requirements.length && item.unread).length,
      Suggestions: suggestions.filter((item) => item.unread).length,
    },
    limitations:
      "Findings are focused checks and recorded assessments. An empty findings list does not prove compliance.",
  };
};
export type BookData = Awaited<ReturnType<typeof readBook>>;
export const requireBook = (book: Book | null) => {
  if (!book) throw new Error("Initialize or migrate a canonical repository book first.");
  return book;
};
