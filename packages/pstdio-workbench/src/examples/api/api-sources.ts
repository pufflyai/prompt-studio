export const apiSources = {
  compositionQuery: `const mainPanels = workbench.composition.panelsFor("main");

mainPanels.open; // Current panel placements in main
mainPanels.addable; // Optional panels available in the active context
mainPanels.closable; // Contribution ids that the user may close`,

  singletonPanel: `ctx.layout.registerPanel({
  id: "app.outline",
  title: "Outline",
  region: "secondary",
  singleton: true,
  eligibleLocations: {},
  rendererId: "app.outline.renderer",
});

const first = ctx.layout.openPanel("app.outline", {
  strategy: { kind: "persistent" },
});
const reopened = ctx.layout.openPanel("app.outline", {
  strategy: { kind: "persistent" },
});

// true: reopening selects and returns the existing panel instance.
console.log(first.instanceId === reopened.instanceId);`,

  resourceTabs: `ctx.layout.registerPanel({
  id: "app.document",
  title: "Document",
  region: "secondary",
  singleton: false,
  reuse: "resource",
  resourceKinds: ["document"],
  eligibleLocations: {},
  rendererId: "app.document.renderer",
});

const openDocument = (resource: ResourceRef) =>
  ctx.layout.openPanel("app.document", {
    resource,
    title: resource.label,
    strategy: { kind: "persistent" },
  });

openDocument({ kind: "document", uri: "document:alpha", label: "Alpha.md" });
openDocument({ kind: "document", uri: "document:beta", label: "Beta.md" });

// Reopening document:alpha selects its existing tab.
openDocument({ kind: "document", uri: "document:alpha", label: "Alpha.md" });`,

  duplicateTabs: `ctx.layout.registerPanel({
  id: "app.scratch",
  title: "Scratch",
  region: "secondary",
  singleton: false,
  reuse: "none",
  eligibleLocations: {},
  rendererId: "app.scratch.renderer",
});

ctx.layout.openPanel("app.scratch", {
  title: "Scratch 1",
  strategy: { kind: "persistent" },
});
ctx.layout.openPanel("app.scratch", {
  title: "Scratch 2",
  strategy: { kind: "persistent" },
});

// The panel definition is shared, but each call creates a new instance and tab.`,

  extensionPlacement: `const extensionId = "pstdio.outline";
const metadata = {
  extensions: [
    { id: extensionId, name: "outline", displayName: "Outline", sourcePath: "" },
  ],
  commands: [
    { id: "outline.list", extensionId, title: "List outline" },
  ],
  menuContributions: [],
  commandPaletteContributions: [],
  modes: [],
  panels: [
    {
      id: "outline",
      extensionId,
      title: "Outline",
      show: {
        region: "main",
        allowedRegions: ["main", "sidenav"],
        required: true,
      },
      renderer: { kind: "tree", id: "outline-tree" },
    },
  ],
  routes: [],
  settingsPanels: [],
  treeItems: [],
  treeRenderers: [
    {
      id: "outline-tree",
      extensionId,
      title: "Outline",
      bodyHandlerId: "outline.list",
    },
  ],
  diagnostics: [],
} satisfies WorkbenchExtensionMetadata;

registerWorkbenchExtensionContributions({
  metadata,
  projectId,
  workbench: ctx,
  executeCommand,
});`,
} as const;
