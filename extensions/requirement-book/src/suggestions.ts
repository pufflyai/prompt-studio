import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { z } from "zod";
import {
  applyOperations,
  type Operation,
  operationIssues,
  operationSchema,
  reconcileOperations,
  serializeBook,
} from "./model";
import { requireBook } from "./read";
import { announce, deleteRecord, digest, readRecord, type Suggestion, saveRecord, suggestionDigest } from "./records";
import { readRepository, writeRepository } from "./repository";

export const suggestionCommands = {
  suggest: defineCommand({
    id: "suggest",
    title: l10n("book.change", "Propose requirement changes"),
    cli: true,
    mutating: true,
    params: {
      workspaceId: params.text(),
      id: params.text(),
      title: params.text({ required: true }),
      reason: params.longText({ required: true }),
      operations: params.json<Operation[], { required: true }>({ required: true }),
      expectedRevision: params.text(),
    },
    async run(ctx, input) {
      const snapshot = await readRepository(ctx, input.workspaceId);
      const book = requireBook(snapshot.book);
      const previous = input.id ? await readRecord<Suggestion>(ctx.storage, "suggestion", input.id) : null;
      if (input.id && !previous?.value) throw new Error("Suggestion no longer exists.");
      if (previous?.value && previous.value.workspaceId !== snapshot.workspaceId)
        throw new Error("Suggestion belongs to another workspace.");
      if (previous?.value?.application && !previous.value.appliedRevision)
        throw new Error("Application is pending. Retry Apply or cancel the application first.");
      if (previous?.value?.appliedRevision)
        throw new Error("Applied suggestions cannot be edited. Create another suggestion.");
      const operations = z.array(operationSchema).min(1).parse(input.operations);
      const issues = operationIssues(book, operations);
      if (issues.length) throw new Error(issues.join("\n"));
      const now = new Date().toISOString();
      const suggestion: Suggestion = {
        id: input.id ?? ctx.storage.ids.create(),
        workspaceId: snapshot.workspaceId,
        title: input.title.trim(),
        reason: input.reason.trim(),
        baseRevision: snapshot.digest,
        operations,
        reviewedDigest: null,
        appliedRevision: null,
        createdAt: previous?.value?.createdAt ?? now,
        updatedAt: now,
      };
      await saveRecord(
        ctx.storage,
        "suggestion",
        { ...previous?.value, ...suggestion },
        input.expectedRevision ?? previous?.record.revision,
      );
      await announce(ctx, snapshot.workspaceId);
      return suggestion;
    },
  }),
  "suggestions.review": defineCommand({
    id: "suggestions.review",
    title: "Review a suggestion",
    cli: true,
    mutating: true,
    params: { id: params.text({ required: true }), expectedDigest: params.text({ required: true }) },
    async run(ctx, input) {
      const { record, value } = await readRecord<Suggestion>(ctx.storage, "suggestion", input.id);
      if (!value) throw new Error("Suggestion not found.");
      if (value.application && !value.appliedRevision)
        throw new Error("Application is pending. Retry Apply or cancel the application first.");
      if (suggestionDigest(value) !== input.expectedDigest)
        throw new Error("Suggestion changed. Inspect its new content.");
      const snapshot = await readRepository(ctx, value.workspaceId);
      const issues = operationIssues(requireBook(snapshot.book), value.operations);
      if (issues.length) throw new Error(issues.join("\n"));
      const next = { ...value, reviewedDigest: input.expectedDigest, updatedAt: new Date().toISOString() };
      await saveRecord(ctx.storage, "suggestion", next, record.revision);
      await announce(ctx, value.workspaceId);
      return next;
    },
  }),
  "suggestions.reconcile": defineCommand({
    id: "suggestions.reconcile",
    title: "Reconcile a suggestion",
    cli: true,
    mutating: true,
    params: { id: params.text({ required: true }), expectedDigest: params.text({ required: true }) },
    async run(ctx, input) {
      const { record, value } = await readRecord<Suggestion>(ctx.storage, "suggestion", input.id);
      if (!value) throw new Error("Suggestion not found.");
      if (value.application && !value.appliedRevision)
        throw new Error("Application is pending. Retry Apply or cancel the application first.");
      if (suggestionDigest(value) !== input.expectedDigest) throw new Error("Suggestion changed. Reload first.");
      const snapshot = await readRepository(ctx, value.workspaceId);
      const book = requireBook(snapshot.book);
      const operations = reconcileOperations(book, value.operations);
      const issues = operationIssues(book, operations);
      if (issues.length) throw new Error(issues.join("\n"));
      const next = {
        ...value,
        operations,
        baseRevision: snapshot.digest,
        reviewedDigest: null,
        updatedAt: new Date().toISOString(),
      };
      await saveRecord(ctx.storage, "suggestion", next, record.revision);
      await announce(ctx, value.workspaceId);
      return next;
    },
  }),
  "suggestions.apply": defineCommand({
    id: "suggestions.apply",
    title: "Apply suggestion to a working branch",
    cli: true,
    mutating: true,
    params: { id: params.text({ required: true }), expectedDigest: params.text({ required: true }) },
    async run(ctx, input) {
      const { record, value } = await readRecord<Suggestion>(ctx.storage, "suggestion", input.id);
      if (!value) throw new Error("Suggestion not found.");
      if (suggestionDigest(value) !== input.expectedDigest)
        throw new Error("Suggestion changed. Inspect its new content.");
      if (value.appliedRevision) return value;
      const snapshot = await readRepository(ctx, value.workspaceId);
      if (value.application?.afterDigest === snapshot.digest) {
        const recovered = { ...value, appliedRevision: snapshot.digest, updatedAt: new Date().toISOString() };
        await saveRecord(ctx.storage, "suggestion", recovered, record.revision);
        await announce(ctx, value.workspaceId);
        return recovered;
      }
      const book = applyOperations(requireBook(snapshot.book), value.operations);
      const application = { beforeDigest: snapshot.digest, afterDigest: digest(serializeBook(book)) };
      await saveRecord(ctx.storage, "suggestion", { ...value, application }, record.revision);
      const prepared = await readRecord<Suggestion>(ctx.storage, "suggestion", value.id);
      if (
        !prepared.value ||
        suggestionDigest(prepared.value) !== input.expectedDigest ||
        digest(prepared.value.application) !== digest(application)
      )
        throw new Error("Application changed before writing. Reload first.");
      const written = await writeRepository(ctx, value.workspaceId, snapshot.content, book);
      const next = { ...value, application, appliedRevision: written.digest, updatedAt: new Date().toISOString() };
      await saveRecord(ctx.storage, "suggestion", next, prepared.record.revision);
      await announce(ctx, value.workspaceId);
      return { ...next, branch: written.branch, bookDigest: written.digest, prCreated: false };
    },
  }),
  "suggestions.cancel-application": defineCommand({
    id: "suggestions.cancel-application",
    title: "Cancel an unapplied application",
    cli: true,
    mutating: true,
    params: { id: params.text({ required: true }) },
    async run(ctx, { id }) {
      const { record, value } = await readRecord<Suggestion>(ctx.storage, "suggestion", id);
      if (!value?.application || value.appliedRevision) throw new Error("There is no pending application.");
      const snapshot = await readRepository(ctx, value.workspaceId);
      if (snapshot.digest !== value.application.beforeDigest)
        throw new Error(
          "The file changed. Retry Apply to recover a completed write, or restore its prior content before cancelling.",
        );
      const { application: _application, ...next } = value;
      await saveRecord(ctx.storage, "suggestion", next, record.revision);
      await announce(ctx, value.workspaceId);
      return next;
    },
  }),
  "suggestions.discard": defineCommand({
    id: "suggestions.discard",
    title: "Discard a local suggestion",
    cli: true,
    mutating: true,
    params: { id: params.text({ required: true }) },
    async run(ctx, { id }) {
      const { value } = await readRecord<Suggestion>(ctx.storage, "suggestion", id);
      if (!value) throw new Error("Suggestion not found.");
      if (value.application && !value.appliedRevision)
        throw new Error("Application is pending. Retry Apply or cancel the application first.");
      if (value.appliedRevision) throw new Error("Applied history cannot be discarded.");
      await deleteRecord(ctx.storage, "suggestion", id);
      await announce(ctx, value.workspaceId);
      return { id };
    },
  }),
};
