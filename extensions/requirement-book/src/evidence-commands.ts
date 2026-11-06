import { defineCommand, params } from "@pstdio/sdk/extensions";
import { z } from "zod";
import { findRule, type Rule } from "./model";
import { requireBook } from "./read";
import {
  announce,
  digest,
  type Finding,
  type Observation,
  readRecord,
  type Suggestion,
  saveRecord,
  suggestionDigest,
} from "./records";
import { readRepository, sourceFingerprint } from "./repository";

export const evidenceCommands = {
  "observations.save": defineCommand({
    id: "observations.save",
    title: "Record qualified evidence",
    cli: true,
    mutating: true,
    params: {
      workspaceId: params.text(),
      id: params.text(),
      title: params.text({ required: true }),
      claim: params.longText({ required: true }),
      kind: params.text({ required: true }),
      conditions: params.longText({ required: true }),
      limits: params.longText({ required: true }),
      sources: params.list(),
      requirements: params.list(),
    },
    async run(ctx, input) {
      const snapshot = await readRepository(ctx, input.workspaceId);
      const book = requireBook(snapshot.book);
      const previous = input.id ? await readRecord<Observation>(ctx.storage, "observation", input.id) : null;
      if (input.id && !previous?.value) throw new Error("Observation no longer exists.");
      if (previous?.value && previous.value.workspaceId !== snapshot.workspaceId)
        throw new Error("Observation belongs to another workspace.");
      const requirements = input.requirements ?? previous?.value?.requirements ?? [];
      for (const ref of requirements) if (!findRule(book.rules, ref)) throw new Error(`Unknown requirement: ${ref}`);
      const kind = z.enum(["source", "assertion", "measurement"]).parse(input.kind);
      const sources = await Promise.all(
        (input.sources ?? []).map(async (path) => ({ path, hash: await sourceFingerprint(ctx, snapshot.root, path) })),
      );
      if (!sources.length) throw new Error("Link at least one inspectable source or result file.");
      if (sources.some((source) => !source.hash)) throw new Error("One of the evidence sources is missing.");
      const observation: Observation = {
        id: input.id ?? ctx.storage.ids.create(),
        workspaceId: snapshot.workspaceId,
        title: input.title.trim(),
        claim: input.claim.trim(),
        kind,
        revision: snapshot.head,
        conditions: input.conditions.trim(),
        limits: input.limits.trim(),
        requirements,
        sources,
        updatedAt: new Date().toISOString(),
      };
      await saveRecord(ctx.storage, "observation", observation, previous?.record.revision);
      await announce(ctx, snapshot.workspaceId);
      return observation;
    },
  }),
  "observations.map": defineCommand({
    id: "observations.map",
    title: "Map or unmap evidence",
    cli: true,
    mutating: true,
    params: { id: params.text({ required: true }), reference: params.text({ required: true }) },
    async run(ctx, input) {
      const { record, value } = await readRecord<Observation>(ctx.storage, "observation", input.id);
      if (!value) throw new Error("Observation not found.");
      const snapshot = await readRepository(ctx, value.workspaceId);
      if (!value.requirements.includes(input.reference) && !findRule(requireBook(snapshot.book).rules, input.reference))
        throw new Error("Choose an existing requirement.");
      const requirements = value.requirements.includes(input.reference)
        ? value.requirements.filter((ref) => ref !== input.reference)
        : [...value.requirements, input.reference];
      const next = { ...value, requirements, updatedAt: new Date().toISOString() };
      await saveRecord(ctx.storage, "observation", next, record.revision);
      await announce(ctx, value.workspaceId);
      return next;
    },
  }),
  "observations.promote": defineCommand({
    id: "observations.promote",
    title: "Propose a requirement from evidence",
    cli: true,
    mutating: true,
    params: {
      id: params.text({ required: true }),
      rule: params.json<Rule, { required: true }>({ required: true }),
      reason: params.longText({ required: true }),
    },
    async run(ctx, input) {
      const { value } = await readRecord<Observation>(ctx.storage, "observation", input.id);
      if (!value) throw new Error("Observation not found.");
      const { suggestionCommands } = await import("./suggestions");
      return suggestionCommands.suggest.run(ctx, {
        workspaceId: value.workspaceId,
        title: input.rule.title,
        reason: input.reason,
        operations: [{ type: "ADD", before: null, after: input.rule }],
        evidence: [value.id],
      });
    },
  }),
  "findings.save": defineCommand({
    id: "findings.save",
    title: "Record a finding",
    cli: true,
    mutating: true,
    params: {
      workspaceId: params.text(),
      id: params.text(),
      kind: params.text({ required: true }),
      title: params.text({ required: true }),
      explanation: params.longText({ required: true }),
      requirements: params.list(),
      observations: params.list(),
      evidence: params.list(),
      resolved: params.boolean(),
    },
    async run(ctx, input) {
      const snapshot = await readRepository(ctx, input.workspaceId);
      const book = requireBook(snapshot.book);
      for (const ref of input.requirements ?? [])
        if (!findRule(book.rules, ref)) throw new Error(`Unknown requirement ${ref}`);
      const previous = input.id ? await readRecord<Finding>(ctx.storage, "finding", input.id) : null;
      if (input.id && !previous?.value) throw new Error("Finding no longer exists.");
      if (previous?.value && previous.value.workspaceId !== snapshot.workspaceId)
        throw new Error("Finding belongs to another workspace.");
      const finding: Finding = {
        id: input.id ?? ctx.storage.ids.create(),
        workspaceId: snapshot.workspaceId,
        kind: z.enum(["violation", "potential-conflict", "missing-evidence", "stale-evidence"]).parse(input.kind),
        title: input.title,
        explanation: input.explanation,
        requirements: input.requirements ?? [],
        observations: input.observations ?? [],
        evidence: input.evidence ?? [],
        resolved: input.resolved ?? false,
        updatedAt: new Date().toISOString(),
      };
      await saveRecord(ctx.storage, "finding", finding, previous?.record.revision);
      await announce(ctx, snapshot.workspaceId);
      return finding;
    },
  }),
  "review.mark-read": defineCommand({
    id: "review.mark-read",
    title: "Mark review items read",
    cli: true,
    mutating: true,
    params: { workspaceId: params.text(), ids: params.list({ required: true }) },
    async run(ctx, input) {
      const workspaceId = (await readRepository(ctx, input.workspaceId)).workspaceId;
      for (const id of input.ids) {
        const items = await Promise.all([
          readRecord<Observation>(ctx.storage, "observation", id),
          readRecord<Finding>(ctx.storage, "finding", id),
          readRecord<Suggestion>(ctx.storage, "suggestion", id),
        ]);
        const item = items.map((record) => record.value).find((value) => value?.workspaceId === workspaceId);
        if (!item) continue;
        const hash = "operations" in item ? suggestionDigest(item) : digest(item);
        await saveRecord(ctx.storage, "read", { id, digest: hash });
      }
      await announce(ctx, workspaceId);
      return { ids: input.ids };
    },
  }),
};
