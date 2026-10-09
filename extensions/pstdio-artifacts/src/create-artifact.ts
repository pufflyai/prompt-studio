import { defineCommand, l10n, params, workbenchPanels } from "@pstdio/sdk/extensions";

export type ArtifactExample = "brief" | "dashboard";

const examples = {
  brief: {
    title: "Create a project brief",
    prompt:
      "Create an interactive project brief using this project's notes and files. Include goals, decisions, current status, and next steps.",
  },
  dashboard: {
    title: "Create a project dashboard",
    prompt:
      "Create an interactive project dashboard showing progress, open work, and upcoming milestones. Use the available project data and clearly label any sample data.",
  },
};

export const startCreation = defineCommand({
  id: "startCreation",
  title: l10n("commands.startCreation", "Create an artifact"),
  cli: true,
  mutating: true,
  params: {
    example: params.select({
      label: l10n("params.example", "Example"),
      required: true,
      options: [
        { value: "brief", label: "Project brief" },
        { value: "dashboard", label: "Project dashboard" },
      ],
    }),
  },
  async run(ctx, input) {
    const example = examples[input.example as ArtifactExample];
    if (!example) throw new Error("Choose a project brief or project dashboard.");
    const session = await ctx.sessions.create({
      title: example.title,
      workspaceId: ctx.workspaceId,
      prompt: `${example.prompt} Follow the publish-artifact skill to create and publish a self-contained HTML artifact. Return its internal artifact URL.`,
    });
    ctx.navigation.open({
      kind: "panel",
      panel: workbenchPanels.projectSession,
      open: "pin",
      resource: {
        type: "session",
        id: session.id,
        extensionId: "pstdio",
        label: session.title,
        metadata: { status: session.status },
      },
    });
    return { sessionId: session.id };
  },
});
