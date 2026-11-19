import { defineCommand, params } from "@pstdio/sdk/extensions";
import { publishBranchTemplate } from "./branch-templates";
import { startCollection } from "./commands";
import { projectRoot, runDeps } from "./context";
import { requirePreviewBridge } from "./preview-bridge";
import { previewCommand } from "./prompt-studio-preview";
import { startRun } from "./runs";
import { withSourceArchive } from "./source";

const sourceParams = {
  path: params.text({ label: "Repository folder (default: this workspace)" }),
  ref: params.text({ label: "Git ref (default: working tree)" }),
};

export const createBranchTemplate = defineCommand({
  id: "templates.branch",
  title: "Publish a branch template",
  cli: true,
  mutating: true,
  params: {
    ...sourceParams,
    kind: params.select({
      label: "Template type",
      required: true,
      options: [
        { value: "tests", label: "Run tests" },
        { value: "preview", label: "Run Prompt Studio" },
      ],
    }),
  },
  async run(ctx, input) {
    if (input.kind !== "tests" && input.kind !== "preview") throw new Error("Choose tests or preview.");
    const kind = input.kind;
    return await withSourceArchive(ctx.process, input.path || (await projectRoot(ctx)), input.ref, async (source) => ({
      template: await publishBranchTemplate(ctx, kind, source, ctx.signal),
      revision: source.revision,
      sourceSha256: source.sha256,
    }));
  },
});

export const runPromptStudio = defineCommand({
  id: "preview.run",
  title: "Run Prompt Studio",
  cli: true,
  mutating: true,
  params: {
    ...sourceParams,
    timeoutMinutes: params.number({ label: "Preview duration in minutes", default: 60 }),
  },
  async run(ctx, input) {
    const timeoutMinutes = input.timeoutMinutes ?? 60;
    if (timeoutMinutes < 1 || timeoutMinutes > 90) throw new Error("Choose a preview duration from 1 to 90 minutes.");
    await requirePreviewBridge(ctx);
    const { record } = await startRun(
      await runDeps(ctx),
      {
        root: input.path || (await projectRoot(ctx)),
        ref: input.ref,
        kind: "preview",
        timeoutMinutes,
        command: previewCommand,
      },
      ctx.signal,
    );
    await startCollection(ctx, record.runId);
    return {
      runId: record.runId,
      workspaceId: record.environmentId,
      template: record.template,
    };
  },
});

export const openPromptStudio = defineCommand({
  id: "preview.open",
  title: "Open the Prompt Studio preview",
  cli: true,
  params: { workspaceId: params.text({ label: "Preview workspace ID", required: true }) },
  async run(ctx, { workspaceId }) {
    const bridge = await requirePreviewBridge(ctx);
    const result = await ctx.process.run({
      command: ["bun", bridge, workspaceId],
      timeoutMs: 10 * 60_000,
    });
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || "Could not open the preview.");
    return JSON.parse(result.stdout) as { url: string; expiresAt: string };
  },
});
