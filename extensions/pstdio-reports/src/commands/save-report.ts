import { type ArtifactMount, defineCommand, params } from "@pstdio/sdk/extensions";
import { reportsCollection } from "../data/collections";
import {
  fileNameFromPath,
  readReportMarkdown,
  reportFilesPattern,
  reportMarkdownPathFor,
  reportToMarkdown,
  requireRepoFiles,
} from "../data/draft-storage";
import { parseReportFrontmatter, stripFrontmatter } from "../data/frontmatter";
import { findReport, resolveWorkspace } from "../data/resolve";
import type { StoredReport, StoredReportFile } from "../data/types";
import { assertSafeReportFileName, assertSafeReportName } from "../data/validation";

const hashBytes = async (bytes: Uint8Array) => {
  const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", input))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const mimeTypeFor = (name: string) => {
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".md")) return "text/markdown";
  if (name.endsWith(".txt") || name.endsWith(".log")) return "text/plain";
  return null;
};

const readReportFiles = async (repoFiles: ArtifactMount, report: StoredReport) => {
  const now = new Date().toISOString();
  const previous = new Map(report.files.map((file) => [file.name, file]));
  const entries = await repoFiles.list(reportFilesPattern(report));

  return Promise.all(
    entries.map(async (entry): Promise<{ file: StoredReportFile; bytes: Uint8Array }> => {
      const name = fileNameFromPath(report, entry.path);
      assertSafeReportFileName(name);
      const bytes = await repoFiles.readBytes(entry.path);
      const existing = previous.get(name);
      return {
        bytes,
        file: {
          id: existing?.id ?? crypto.randomUUID(),
          name,
          blobId: "",
          mimeType: mimeTypeFor(name),
          size: bytes.byteLength,
          hash: await hashBytes(bytes),
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        },
      };
    }),
  );
};

export const saveReportCommand = defineCommand({
  id: "reports.save",
  title: "Save report",
  cli: {
    globalAliases: [["reports", "save"]],
    examples: ["pstdio reports save --name review"],
  },
  params: {
    workspace: params.text(),
    name: params.text(),
  },
  async run(ctx, commandParams) {
    const repoFiles = requireRepoFiles(ctx.repoFiles);
    const { workspace, workspaceShorthand } = await resolveWorkspace(ctx, commandParams.workspace);
    let name = commandParams.name;

    if (!name) {
      const reports = (await reportsCollection(ctx.storage).list()).filter(
        (report) => report.workspaceShorthand === workspaceShorthand,
      );
      if (reports.length !== 1) throw new Error("Pass --name when the workspace has zero or multiple reports.");
      name = reports[0]!.name;
    }

    assertSafeReportName(name);
    const report = await findReport(ctx.storage, workspaceShorthand, name);
    if (!report) throw new Error(`Unknown report "${name}" in workspace "${workspaceShorthand}"`);

    const raw = await readReportMarkdown(repoFiles, report);
    if (raw === null) throw new Error(`No local report file for ${name}`);
    const frontmatter = parseReportFrontmatter(raw);
    const body = stripFrontmatter(raw).replace(/^\n+/, "");
    const fileInputs = await readReportFiles(repoFiles, report);
    const blobs = reportsCollection(ctx.storage).attachments(report.id);
    const uploadedFiles = await Promise.all(
      fileInputs.map(async ({ bytes, file }) => {
        const blob = await blobs.put({ name: file.name, data: bytes, mimeType: file.mimeType ?? undefined });
        return { ...file, blobId: blob.id };
      }),
    );
    const nextFiles = uploadedFiles;

    const next: StoredReport = {
      ...report,
      kind: frontmatter.kind ?? report.kind,
      source: frontmatter.source ?? report.source,
      body,
      files: nextFiles,
      draft: false,
      updatedAt: new Date().toISOString(),
    };
    try {
      await reportsCollection(ctx.storage).put(report.id, next);
    } catch (error) {
      await Promise.allSettled(nextFiles.map((file) => blobs.delete(file.blobId)));
      throw error;
    }
    const oldBlobIds = new Set(report.files.map((file) => file.blobId));
    await Promise.allSettled([...oldBlobIds].map((blobId) => blobs.delete(blobId)));
    await repoFiles.writeText(reportMarkdownPathFor(next), reportToMarkdown(next));

    await ctx.events.emit("pstdio-reports.report.saved", {
      projectId: ctx.projectId,
      reportId: report.id,
      workspaceShorthand,
      workspaceId: workspace?.id ?? null,
      name,
      kind: next.kind,
      files: nextFiles.length,
    });

    return { reportId: report.id, workspace: workspaceShorthand, name, files: nextFiles.length };
  },
});
