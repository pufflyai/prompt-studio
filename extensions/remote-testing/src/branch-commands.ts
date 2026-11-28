import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { publishBranchTemplate } from "./branch-templates";
import { startCollection } from "./collection";
import { connectionApi } from "./connection";
import { projectRoot, runDeps } from "./context";
import { openKitoPreview } from "./kito-workflow";
import { requirePreviewBridge } from "./preview-bridge";
import { previewCommand } from "./prompt-studio-preview";
import { startRun } from "./runs";
import { withSourceArchive } from "./source";

const sourceParams = {
  path: params.text({
    label: l10n(
      "remote-testing.repository-folder-default-this-workspace",
      "Repository folder (default: this workspace)",
    ),
  }),
  ref: params.text({ label: l10n("remote-testing.git-ref-default-working-tree", "Git ref (default: working tree)") }),
  base: params.text({ label: l10n("remote-testing.comparison-base", "Comparison base (default: origin/main)") }),
};

export const createBranchTemplate = defineCommand({
  id: "templates.branch",
  title: l10n("remote-testing.publish-a-branch-template", "Publish a branch template"),
  cli: true,
  mutating: true,
  params: {
    ...sourceParams,
    kind: params.select({
      label: l10n("remote-testing.template-type", "Template type"),
      required: true,
      options: [
        { value: "tests", label: "Run tests", localizedLabel: l10n("remote-testing.run-tests", "Run tests") },
        {
          value: "preview",
          label: "Run Prompt Studio",
          localizedLabel: l10n("remote-testing.run-prompt-studio", "Run Prompt Studio"),
        },
      ],
    }),
  },
  async run(ctx, input) {
    if (input.kind !== "tests" && input.kind !== "preview") throw new Error("Choose tests or preview.");
    const kind = input.kind;
    return await withSourceArchive(
      ctx.process,
      input.path || (await projectRoot(ctx)),
      input.ref,
      async (source) => ({
        template: await publishBranchTemplate(ctx, kind, source, ctx.signal),
        revision: source.revision,
        sourceSha256: source.sha256,
      }),
      input.base,
    );
  },
});

export const runPromptStudio = defineCommand({
  id: "preview.run",
  title: l10n("remote-testing.run-prompt-studio", "Run Prompt Studio"),
  cli: true,
  mutating: true,
  params: {
    ...sourceParams,
    timeoutMinutes: params.number({
      label: l10n("remote-testing.preview-duration-in-minutes", "Preview duration in minutes"),
      default: 60,
    }),
  },
  async run(ctx, input) {
    const timeoutMinutes = input.timeoutMinutes ?? 60;
    if (timeoutMinutes < 1 || timeoutMinutes > 90) throw new Error("Choose a preview duration from 1 to 90 minutes.");
    if ((await ctx.settings.all()).kitoWorkflow !== true) await requirePreviewBridge(ctx);
    const { record } = await startRun(
      await runDeps(ctx),
      {
        root: input.path || (await projectRoot(ctx)),
        ref: input.ref,
        base: input.base,
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
  title: l10n("remote-testing.open-the-prompt-studio-preview", "Open the Prompt Studio preview"),
  cli: true,
  params: {
    workspaceId: params.text({
      label: l10n("remote-testing.preview-workspace-id", "Preview workspace ID"),
      required: true,
    }),
  },
  async run(ctx, { workspaceId }) {
    if ((await ctx.settings.all()).kitoWorkflow === true)
      return openKitoPreview(connectionApi(ctx.connections), workspaceId, ctx.signal);
    const bridge = await requirePreviewBridge(ctx);
    const result = await ctx.process.run({
      command: ["bun", bridge, workspaceId],
      timeoutMs: 10 * 60_000,
    });
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || "Could not open the preview.");
    return { ...(JSON.parse(result.stdout) as { url: string; expiresAt: string }), workspaceId };
  },
});
