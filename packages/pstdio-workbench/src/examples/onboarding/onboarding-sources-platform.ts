export const onboardingPlatformSources = {
  resourceMenuSlots: `import {
  defineCommand,
  defineExtension,
  defineResourceKind,
  resourceMenuSlotRef,
} from "@pstdio/sdk/extensions";

const ticket = defineResourceKind({
  id: "ticket",
  label: "Ticket",
  menuSlots: [
    {
      id: "headerActions",
      placement: "header-primary",
      access: "owner",
    },
  ],
});

const openTicket = defineCommand({
  id: "open-ticket",
  title: "Open ticket",
  menus: [
    {
      slot: resourceMenuSlotRef(ticket.ref, "headerActions"),
      label: "Open ticket",
      presentation: "button",
    },
  ],
  async run(ctx) {
    return { ticketId: ctx.resource?.id };
  },
});

export default defineExtension({
  resourceKinds: [ticket],
  commands: [openTicket],
});`,

  webviewCapabilities: `import {
  artifactsRead,
  defineArtifactMount,
  defineExtension,
  definePage,
  defineView,
  packageAsset,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const runArtifacts = defineArtifactMount({
  id: "runs",
  path: "runs",
  label: "Run artifacts",
});

const overview = defineView({
  id: "overview",
  title: "Overview",
  body: {
    kind: "webview",
    entry: packageAsset("./overview.tsx", import.meta.url),
    capabilities: [
      "commands.execute",
      "notification.show",
      artifactsRead(runArtifacts),
    ],
  },
});

const overviewPage = definePage({
  id: "overview",
  title: "Overview",
  path: "overview",
  mode: workbenchModes.project,
  slots: [
    { id: "content", role: "primary", region: "main", view: overview.ref },
  ],
});

export default defineExtension({
  artifactMounts: [runArtifacts],
  views: [overview],
  pages: [overviewPage],
});`,
} as const;
