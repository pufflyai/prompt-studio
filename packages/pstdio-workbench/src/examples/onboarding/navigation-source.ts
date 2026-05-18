export const navigationSource = `import type {
  NavigationTargetItem,
  ResourceRef,
  WorkbenchModuleContribution,
} from "pstdio-workbench/core";

const GUIDE_KIND = "docs.guide";
const GUIDE_WIDGET_ID = "docs.guide";
const TREE_WIDGET_ID = "docs.navigation";

const guideResource = (id: string): ResourceRef => ({
  kind: GUIDE_KIND,
  uri: \`\${GUIDE_KIND}:\${id}\`,
  id,
  label: \`Guide \${id}\`,
});

export const createNavigationModule = (): WorkbenchModuleContribution => ({
  id: "docs.navigation",
  activate(ctx) {
    ctx.resources.registerKind({ kind: GUIDE_KIND, label: "Guide", icon: "FileText" });

    ctx.resources.registerOpener({
      id: "docs.guide-opener",
      canOpen: (resource) => resource.kind === GUIDE_KIND,
      open: (resource) =>
        ctx.layout.openWidget(GUIDE_WIDGET_ID, {
          resource,
          title: resource.label,
        }),
    });

    ctx.navigation.registerNavigator({
      id: "docs.guide-navigator",
      canNavigate: (resource) => resource.kind === GUIDE_KIND,
      createHref: (resource) => \`docs://guide/\${resource.id ?? "start"}\`,
      navigate: (resource) =>
        ctx.layout.openWidget(GUIDE_WIDGET_ID, {
          resource,
          title: resource.label,
        }),
    });

    ctx.navigation.registerParser({
      id: "docs.navigation-parser",
      canParse: (location) => location.startsWith("docs://"),
      parse(location) {
        const url = new URL(location);
        // The host selects which target shape this location should produce.
        // The path carries the guide id when the target opens a guide resource.
        const pathId = url.pathname.replace(/^\\//, "");

        // docs://guide/start becomes a resource target. The dispatcher sends
        // resource targets through the registered resource opener above.
        if (url.host === "guide") {
          return { kind: "resource", resource: guideResource(pathId || "start") };
        }

        // docs://view/navigation becomes a view target. The dispatcher reveals
        // or opens the registered navigation tree widget.
        if (url.host === "view") {
          return { kind: "view", widgetId: TREE_WIDGET_ID };
        }

        // docs://command/focus-main becomes a command target. The path is
        // illustrative here; this example always routes to the built-in command.
        if (url.host === "command") {
          return { kind: "command", commandId: "workbench.focusMain" };
        }

        // docs://open/review?tree=true becomes a compound target. Compound
        // targets run in order, so this opens the guide and optionally reveals the tree.
        if (url.host === "open") {
          const targets: NavigationTargetItem[] = [
            { kind: "resource", resource: guideResource(pathId || "review") },
          ];
          if (url.searchParams.get("tree") === "true") {
            targets.push({ kind: "view", widgetId: TREE_WIDGET_ID });
          }
          return { kind: "compound", targets };
        }

        throw new Error(\`Unknown docs navigation host: \${url.host}\`);
      },
    });
  },
});`;
