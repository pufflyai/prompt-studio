import { expect, test } from "bun:test";
import { createMemoryActivity, createMemoryRepoFiles, createMemoryStorage } from "@pstdio/sdk/testing";
import { putReport, reportsCollection } from "../data/collections";
import { readReportWithBody, reportBodyFile } from "../data/report-body";
import { makeCommandContext } from "./command-context.fixture";
import { exportReportCommand, redirectReportCommand } from "./export-report";
import { readReportCommand } from "./read-report";

test("historical RP references retain bodies and evidence after a verified, resumable Activity redirect", async () => {
  const storage = createMemoryStorage();
  const activity = createMemoryActivity();
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: { extensionId: "pstdio.pstdio-reports", activity },
  });
  const allocated = await ctx.resources.allocate({ kind: "report" });
  const blobs = reportsCollection(storage).attachments(allocated.id);
  const body = "Historical evidence\n".repeat(20000);
  const fileBytes = new TextEncoder().encode("Verified trace");
  const bodyFile = await blobs.put(reportBodyFile(body));
  const file = await blobs.put({ name: "trace.log", mimeType: "text/plain", data: fileBytes });
  const hash = new Bun.CryptoHasher("sha256").update(fileBytes).digest("hex");
  const createdAt = "2026-10-01T12:00:00.000Z";
  await putReport(storage, {
    id: allocated.id,
    workspaceShorthand: "WS-1",
    workspaceId: "workspace",
    name: "change_request",
    kind: "change_request",
    source: "historical-agent",
    bodyBlobId: bodyFile.id,
    files: [
      {
        id: "old-file",
        name: "trace.log",
        blobId: file.id,
        mimeType: "text/plain",
        size: fileBytes.length,
        hash,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    draft: false,
    createdAt,
    updatedAt: createdAt,
  });
  const exported = await exportReportCommand.run(ctx, { id: allocated.id });
  expect(exported.report.body).toBe(body);
  expect(exported.files[0]!.base64).toBe(Buffer.from(fileBytes).toString("base64"));
  const resource = { projectId: ctx.projectId, extensionId: "pstdio.pstdio-planner", type: "ticket", id: "ticket" };
  const attached = await activity.attach(resource, {
    key: "historical-file",
    name: "trace.log",
    mimeType: "text/plain",
    data: fileBytes,
  });
  const imported = await activity.importEntry(resource, {
    entry: {
      key: "historical-report",
      kind: "implementation",
      body,
      revision: {
        workspaceId: "workspace",
        sessionId: "old-session",
        headSha: "a".repeat(40),
        baseSha: "b".repeat(40),
        revision: 1,
      },
      attachmentIds: [attached.id],
    },
    author: { type: "agent", id: "old-agent", name: "Historical agent" },
    createdAt,
    source: { projectId: ctx.projectId, extensionId: ctx.extensionId, type: "report", id: allocated.id },
  });
  await redirectReportCommand.run(ctx, { id: allocated.id, resource, entryId: imported.id });
  await redirectReportCommand.run(ctx, { id: allocated.id, resource, entryId: imported.id });
  expect((await readReportWithBody(storage, allocated.id, activity))!.body).toBe(body);
  expect((await reportsCollection(storage).get(allocated.id))!.bodyBlobId).toBe("");
  await expect(blobs.getBytes(bodyFile.id)).rejects.toThrow();
  await expect(blobs.getBytes(file.id)).rejects.toThrow();
  expect(await readReportCommand.run(ctx, { id: allocated.shorthand })).toMatchObject({
    id: allocated.id,
    body,
    activityRefs: [{ id: imported.id }],
    files: [{ id: "old-file", activityAttachmentId: attached.id }],
  });
  expect(await activity.get(resource, imported.id)).toMatchObject({ author: { id: "old-agent" }, createdAt });
  expect(new TextDecoder().decode((await activity.readAttachment(resource, attached.id)).data)).toBe("Verified trace");
  const secondResource = { ...resource, id: "another-ticket" };
  const secondFile = await activity.attach(secondResource, {
    name: "trace.log",
    mimeType: "text/plain",
    data: fileBytes,
  });
  const secondEntry = await activity.importEntry(secondResource, {
    entry: {
      key: "same-report-another-ticket",
      kind: "implementation",
      body,
      revision: imported.revision!,
      attachmentIds: [secondFile.id],
    },
    author: imported.author,
    createdAt,
    source: imported.origin!.resource,
  });
  await redirectReportCommand.run(ctx, { id: allocated.id, resource: secondResource, entryId: secondEntry.id });
  const recovered = await exportReportCommand.run(ctx, { id: allocated.id });
  expect(recovered.files[0]!.base64).toBe(Buffer.from(fileBytes).toString("base64"));
  expect(recovered.report.activityRefs).toHaveLength(2);
});

test("a report save admitted before migration retains the new evidence", async () => {
  const storage = createMemoryStorage();
  const activity = createMemoryActivity();
  const projectFiles = createMemoryRepoFiles();
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: { extensionId: "pstdio.pstdio-reports", activity, projectFiles },
  });
  const { writeReportCommand } = await import("./write-report");
  const { saveReportCommand } = await import("./save-report");
  const written = await writeReportCommand.run(ctx, { name: "race", template: "review" });
  const original = await readReportWithBody(storage, written.reportId, activity);
  const resource = { projectId: ctx.projectId, extensionId: "pstdio.pstdio-planner", type: "ticket", id: "race" };
  const entry = await activity.importEntry(resource, {
    entry: {
      key: "old-evidence",
      kind: "implementation",
      body: original!.body,
      revision: { workspaceId: "workspace", sessionId: "old-agent", headSha: "a".repeat(40), revision: 1 },
    },
    author: { type: "agent", id: "old-agent", name: "Agent" },
    createdAt: original!.createdAt,
    source: { projectId: ctx.projectId, extensionId: ctx.extensionId, type: "report", id: written.reportId },
  });
  await projectFiles.writeText(
    ".pstdio/extension-storage/pstdio.pstdio-reports/reports/race/report.md",
    "New evidence",
  );
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const readText = projectFiles.readText.bind(projectFiles);
  ctx.projectFiles!.readText = async (path) => {
    entered.resolve();
    await release.promise;
    return readText(path);
  };
  const saving = saveReportCommand.run(ctx, { name: "race" });
  await entered.promise;
  const redirecting = redirectReportCommand.run(ctx, { id: written.reportId, resource, entryId: entry.id });
  await Bun.sleep(10);
  release.resolve();
  const results = await Promise.allSettled([saving, redirecting]);
  expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected"]);
  expect((await readReportWithBody(storage, written.reportId, activity))!.body).toBe("New evidence");
  expect((await reportsCollection(storage).get(written.reportId))!.activityRefs).toBeUndefined();
});
