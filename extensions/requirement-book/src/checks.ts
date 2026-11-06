import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import type { Book } from "./model";
import { announce, digest, type Finding, listRecords, type Observation, saveRecord } from "./records";
import { readRepository, sourceFingerprint } from "./repository";

export const freshness = async (ctx: ExtensionContextBase, root: string, observation: Observation) => {
  const sources = await Promise.all(
    observation.sources.map(async (source) => ({
      ...source,
      current: await sourceFingerprint(ctx, root, source.path),
    })),
  );
  return {
    stale: sources.some((source) => source.current !== source.hash),
    missing: sources.some((source) => source.current === null),
    sources,
  };
};
export const missingEvidence = (book: Book, observations: Observation[]) =>
  book.rules.filter(
    (rule) =>
      rule.acceptance.length > 0 &&
      !observations.some(
        (observation) => observation.requirements.includes(rule.ref) && observation.kind === "measurement",
      ),
  );
export const checkWorkspace = async (ctx: ExtensionContextBase, workspaceId?: string) => {
  const snapshot = await readRepository(ctx, workspaceId);
  if (!snapshot.book) return { checked: 0, limitations: "No canonical book in this revision." };
  const observations = (await listRecords<Observation>(ctx.storage, "observation")).filter(
    (item) => item.workspaceId === snapshot.workspaceId,
  );
  const existing = (await listRecords<Finding>(ctx.storage, "finding")).filter(
    (item) => item.workspaceId === snapshot.workspaceId,
  );
  const expected = new Set<string>();
  let changed = false;
  const save = async (finding: Finding) => {
    expected.add(finding.id);
    const previous = existing.find((item) => item.id === finding.id);
    if (previous && digest({ ...previous, updatedAt: "" }) === digest({ ...finding, updatedAt: "" })) return;
    await saveRecord(ctx.storage, "finding", finding);
    changed = true;
  };
  for (const observation of observations) {
    const status = await freshness(ctx, snapshot.root, observation);
    if (status.stale || status.missing)
      await save({
        id: `stale-${observation.id}`,
        workspaceId: snapshot.workspaceId,
        kind: "stale-evidence",
        managedBy: "focused-check",
        title: `Recheck ${observation.title}`,
        explanation:
          "A referenced source changed or is missing. The earlier claim and its conditions remain available; it does not establish current behavior.",
        requirements: observation.requirements,
        observations: [observation.id],
        evidence: status.sources.map(
          (source) => `${source.path}: recorded ${source.hash ?? "missing"}; current ${source.current ?? "missing"}`,
        ),
        resolved: false,
        updatedAt: new Date().toISOString(),
      });
  }
  for (const rule of missingEvidence(snapshot.book, observations))
    await save({
      id: `gap-${snapshot.workspaceId}-${rule.ref}`,
      workspaceId: snapshot.workspaceId,
      kind: "missing-evidence",
      managedBy: "focused-check",
      title: `Verification gap · ${rule.ref}`,
      explanation:
        "Acceptance conditions have no recorded executed measurement. This is a verification gap, not a demonstrated product violation.",
      requirements: [rule.ref],
      observations: [],
      evidence: rule.acceptance.flatMap((item) => item.tests),
      resolved: false,
      updatedAt: new Date().toISOString(),
    });
  for (const finding of existing.filter(
    (item) => !item.resolved && item.managedBy === "focused-check" && !expected.has(item.id),
  )) {
    await saveRecord(ctx.storage, "finding", { ...finding, resolved: true, updatedAt: new Date().toISOString() });
    changed = true;
  }
  if (changed) await announce(ctx, snapshot.workspaceId);
  return {
    checked: snapshot.book.rules.length,
    limitations:
      "Exact references, source fingerprints and missing execution records are checked. No complete semantic analysis or test execution is implied.",
  };
};
