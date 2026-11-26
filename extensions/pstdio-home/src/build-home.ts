import { defineCommand, params, sessionBrowser } from "@pstdio/sdk/extensions";
import { homeIdeas } from "./home-ideas";

export const buildHome = defineCommand({
  id: "build-home",
  title: "Build a Home page idea",
  cli: true,
  mutating: true,
  params: {
    idea: params.select({
      required: true,
      label: "Home page idea",
      options: homeIdeas.map(({ id, title }) => ({ value: id, label: title })),
    }),
  },
  async run(ctx, { idea: id }) {
    const idea = homeIdeas.find((idea) => idea.id === id);
    if (!idea) throw new Error("Choose a Home page idea.");
    const session = await ctx.sessions.create({
      title: `Build Home: ${idea.title}`,
      prompt: `${idea.prompt}\nRead the existing Home extension and use its "${idea.id}.png" screenshot as a layout reference.`,
      workspaceId: ctx.workspaceId,
    });
    ctx.navigation.open({
      kind: "panel",
      panel: sessionBrowser.panels.conversation,
      open: "pin",
      resource: {
        type: "session",
        id: session.id,
        extensionId: "pstdio",
        projectId: ctx.projectId,
        label: session.title,
        metadata: { status: session.status },
      },
    });
    return { sessionId: session.id };
  },
});
