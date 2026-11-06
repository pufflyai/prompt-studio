import { defineCommand, params } from "@pstdio/sdk/extensions";
import { z } from "zod";
import { findRule } from "./model";
import { requireBook } from "./read";
import { readRecordGroups } from "./read-index";
import { announce, digest, type Finding, readRecord, saveRecord, suggestionDigest } from "./records";
import { readRepository } from "./repository";

export const reviewCommands = {
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
        resolved: input.resolved ?? false,
        updatedAt: new Date().toISOString(),
      };
      await saveRecord(ctx.storage, "finding", { ...previous?.value, ...finding }, previous?.record.revision);
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
      const records = await readRecordGroups(ctx);
      for (const id of input.ids) {
        const item = [...records.findings, ...records.suggestions].find(
          (value) => value.id === id && value.workspaceId === workspaceId,
        );
        if (!item) continue;
        const hash = "operations" in item ? suggestionDigest(item) : digest(item);
        await saveRecord(ctx.storage, "read", { id, digest: hash });
      }
      await announce(ctx, workspaceId);
      return { ids: input.ids };
    },
  }),
};
