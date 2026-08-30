export const navigationSource = `import type {
  NavigationTargetItem,
  ResourceRef,
  WorkbenchModuleContribution,
} from "@pstdio/workbench";

const PAGE_ID = "docs.page";
const GUIDE_KIND = "docs.guide";
const GUIDE_WIDGET_ID = "docs.guide";
const TREE_WIDGET_ID = "docs.navigation";
const TREE_SLOT_ID = "tree";
const FOCUS_MAIN_COMMAND_ID = "docs.navigation.focus-main";

const guideResource = (id: string): ResourceRef => ({
  kind: GUIDE_KIND,
  uri: \`\${GUIDE_KIND}:\${id}\`,
  id,
  label: \`Guide \${id}\`,
});

export const createNavigationModule = (): WorkbenchModuleContribution => ({
  id: "docs.navigation",
  activate(ctx) {
    ctx.commands.registerCommand(
      { id: FOCUS_MAIN_COMMAND_ID, label: "Focus main", category: "Docs" },
      { execute: () => ctx.focus.setActiveRegion("main") },
    );

    ctx.resources.registerKind({ kind: GUIDE_KIND, label: "Guide", icon: "FileText" });

    // The page is the navigable destination. Its binding places guide
    // resources into the bound slot; the tree lives in a static slot.
    ctx.pages.registry.registerPage({
      id: PAGE_ID,
      title: "Docs",
      slots: [
        { id: "guides", region: "main", cardinality: "one" },
        { id: TREE_SLOT_ID, region: "sidenav", panelId: TREE_WIDGET_ID },
      ],
      bindings: [{ kind: GUIDE_KIND, panelId: GUIDE_WIDGET_ID, slot: "guides" }],
    });

    ctx.navigation.registerNavigator({
      id: "docs.guide-navigator",
      canNavigate: (resource) => resource.kind === GUIDE_KIND,
      createHref: (resource) => \`docs://guide/\${resource.id ?? "start"}\`,
      navigate: (resource) => ctx.pages.activatePage(PAGE_ID, { resource }),
    });

    ctx.navigation.registerParser({
      id: "docs.navigation-parser",
      canParse: (location) => location.startsWith("docs://"),
      parse(location) {
        const url = new URL(location);
        // The host selects which target shape this location should produce.
        // The path carries the guide id when the target opens a guide resource.
        const pathId = url.pathname.replace(/^\\//, "");

        // docs://guide/start becomes a page target with the guide as its
        // resource argument. The page's binding decides which panel shows it.
        if (url.host === "guide") {
          return { kind: "page", pageId: PAGE_ID, resource: guideResource(pathId || "start") };
        }

        // docs://view/navigation becomes a page target with a slot id. The
        // dispatcher reveals the page's static tree slot.
        if (url.host === "view") {
          return { kind: "page", pageId: PAGE_ID, slot: TREE_SLOT_ID };
        }

        // docs://command/focus-main becomes a command target. The path is
        // illustrative here; this example routes to a module-owned command.
        if (url.host === "command") {
          return { kind: "command", commandId: FOCUS_MAIN_COMMAND_ID };
        }

        // docs://open/review?tree=true becomes a compound target. Compound
        // targets run in order, so this opens the guide and optionally reveals the tree.
        if (url.host === "open") {
          const targets: NavigationTargetItem[] = [
            { kind: "page", pageId: PAGE_ID, resource: guideResource(pathId || "review") },
          ];
          if (url.searchParams.get("tree") === "true") {
            targets.push({ kind: "page", pageId: PAGE_ID, slot: TREE_SLOT_ID });
          }
          return { kind: "compound", targets };
        }

        throw new Error(\`Unknown docs navigation host: \${url.host}\`);
      },
    });
  },
});`;
