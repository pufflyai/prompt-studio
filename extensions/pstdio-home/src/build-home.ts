import { defineCommand, params, sessionBrowser } from "@pstdio/sdk/extensions";
import { homeIdeaScreenshotUrl, homeIdeas } from "./home-ideas";

export const buildHome = defineCommand({
  id: "build-home",
  title: "Start a Home page idea",
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
    const prompt =
      idea.kind === "build"
        ? `${idea.prompt}\nRead the existing Home extension. Use these example interfaces as design references, adapting sample content to this project.\nLight: ${homeIdeaScreenshotUrl(idea.id, "light")}\nDark: ${homeIdeaScreenshotUrl(idea.id, "dark")}`
        : idea.prompt;
    const session = await ctx.sessions.create({
      title: idea.kind === "explore" ? "Explore Home ideas" : `Build Home: ${idea.title}`,
      prompt,
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
