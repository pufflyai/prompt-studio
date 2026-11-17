import { defineCommand, l10n, params, sessionBrowser } from "@pstdio/sdk/extensions";
import { libraryTarget } from "./contracts";

export const openCreation = defineCommand({
  id: "open-creation",
  title: l10n("commands.startCreation", "Create an artifact"),
  palette: [{ group: "Artifacts", icon: "app-window" }],
  run(ctx) {
    ctx.navigation.open(libraryTarget);
  },
});

export type ArtifactExample = "brief" | "diagram";

const examples = {
  brief: {
    title: "Create a project brief",
    prompt:
      "Create an interactive project brief using this project's notes and files. Include goals, decisions, current status, and next steps.",
  },
  diagram: {
    title: "Create a system diagram",
    // Each rule fixes a gap that first drafts kept showing: package diagrams, stale docs, drawn icons, and crowded pages.
    prompt: [
      "Create an interactive system diagram from this project's code, configuration, and notes.",
      "",
      "What to show:",
      "- Show running systems, not code packages: services, processes, data stores, storage, infrastructure, client apps, and external services. Leave libraries and shared packages for a separate package diagram.",
      "- Group the cards into lanes by role, such as callers and clients, core services, runtime or compute, data, external services, and optional or separately deployed products.",
      "- Check each fact against code and configuration, not only the docs, which can be out of date. Name every supported data store, say which deployment uses which, and say whether systems share a database.",
      "- Draw each line from the system that makes the call, and label it with what it carries. Use different line styles for requests, long-lived streams, events, and configuration.",
      "- Show only what exists in the current code. Mark planned changes as planned.",
      "- Mark assumptions on the card or line itself with a dashed outline and an assumption badge, and explain them in the details panel.",
      "",
      "Icons:",
      "- Put small technology icons, about 14 px, in the top-right corner of each card: the runtime, database, container platform, or cloud it uses.",
      "- Use real logos: the official logo from the technology's site, or Simple Icons (CC0) in brand colors. Use Lucide (ISC) for generic ideas such as files, secrets, disks, or browsers. Download them if needed. Inline the SVG markup after removing scripts, event handlers, links, and ids.",
      "- If a brand color is too dark to see in dark mode, use the text color. Keep card titles clear of the icons.",
      "",
      "Layout and interaction:",
      "- Keep the page to a toolbar, the diagram, and a details panel. Do not add text sections below the diagram.",
      "- The toolbar has a flow dropdown, a toggle to show all line labels, a toggle to highlight assumptions, a reset button, and a Legend button. The legend opens in a dialog with the line styles, icons, and keyboard shortcuts. Esc or a click outside closes it.",
      "- Clicking a card shows its responsibilities, key facts, technology, clickable connections, and source files. Clicking a line shows what it carries and the flows that use it.",
      "- Flows step through the main end-to-end paths one line at a time, with back, next, and play controls.",
      "- Cards work with the keyboard. Line labels are never clipped. Long lines run through the gaps between lanes instead of across cards.",
      "",
      "If a browser is available, render the page in the light and dark themes before publishing, check the screenshots, and fix overlaps and clipped text.",
    ].join("\n"),
  },
};

export const startCreation = defineCommand({
  id: "start-creation",
  title: l10n("commands.startCreation", "Create an artifact"),
  cli: true,
  mutating: true,
  params: {
    example: params.select({
      label: l10n("params.example", "Example"),
      required: true,
      options: [
        { value: "brief", label: "Project brief" },
        { value: "diagram", label: "System diagram" },
      ],
    }),
  },
  async run(ctx, input) {
    const example = examples[input.example as ArtifactExample];
    if (!example) throw new Error("Choose a project brief or system diagram.");
    const session = await ctx.sessions.create({
      title: example.title,
      workspaceId: ctx.workspaceId,
      prompt: `${example.prompt} Follow the publish-artifact skill to create and publish a self-contained HTML artifact. Return its internal artifact URL.`,
    });
    ctx.navigation.open({
      kind: "panel",
      panel: sessionBrowser.panels.conversation,
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
