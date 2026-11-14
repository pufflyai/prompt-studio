import { expect, test } from "bun:test";
import {
  contributionRefId,
  defineCommand,
  defineExtension,
  defineNavigationTree,
  definePage,
  defineView,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import type { LoadedExtensionSource } from "pstdio-extensions";
import { normalizeExtensionSources } from "pstdio-extensions";
import { createWorkbenchExtensionMetadata } from "pstdio-extensions/workbench";
import { createWorkbench } from "../../core";
import { registerWorkbenchExtensionContributions } from "./workbench-extension-host";

const source = (name: string, definition: LoadedExtensionSource["definition"]): LoadedExtensionSource => ({
  packagePath: `/fake/${name}`,
  sourcePath: `/fake/${name}/extension.ts`,
  sourceKind: "local_path",
  manifest: {
    id: `acme.${name}`,
    publisher: "acme",
    name,
    version: "1.0.0",
    main: "extension.ts",
    enginesPstdio: "^0.4.0 || ^0.5.0",
  },
  definition,
});

test("optional foreign trees do not query retained owners while absent and reattach after install or reenable", async () => {
  const owner = { kind: "page", extensionId: "acme.provider", id: "workspace" } as const;
  const tree = defineView({ id: "sessions", title: "Sessions", body: { kind: "tree", body: async () => [] } });
  const consumer = source(
    "consumer",
    defineExtension({
      commands: [defineCommand({ id: "ping", title: "Ping", run: async () => "available" })],
      views: [tree],
      navigationTrees: [defineNavigationTree({ id: "sessions", owner, optionalOwner: true, view: tree.ref })],
    }),
  );
  const providerView = defineView({ id: "files", title: "Files", body: { kind: "tree", body: async () => [] } });
  const provider = source(
    "provider",
    defineExtension({
      views: [providerView],
      pages: [
        definePage({
          id: "workspace",
          title: "Workspace",
          path: "workspace",
          mode: workbenchModes.project,
          main: { kind: "view", view: providerView.ref, cardinality: "one" },
          slots: [],
        }),
      ],
    }),
  );
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "project", activate() {} });
  workbench.pageLocations.setProject("project");
  const retainedOwner = { ...owner, id: contributionRefId(owner) };
  let registration: ReturnType<typeof registerWorkbenchExtensionContributions> | undefined;
  let queries = 0;
  try {
    for (const phase of ["absent", "installed", "disabled", "reenabled", "removed"]) {
      const present = phase === "installed" || phase === "reenabled";
      const metadata = createWorkbenchExtensionMetadata({
        runtime: normalizeExtensionSources(present ? [consumer, provider] : [consumer]),
      });
      expect(metadata.navigationTrees).toHaveLength(present ? 1 : 0);
      registration?.dispose();
      registration = registerWorkbenchExtensionContributions({
        workbench,
        projectId: "project",
        metadata,
        executeCommand: async (id) => {
          if (id.endsWith(".command.ping")) return "available";
          queries++;
          return [{ id: "sessions", nodes: [{ id: "linked", label: "Linked session" }] }];
        },
      });
      expect(Boolean(workbench.pages.getPage(contributionRefId(owner)))).toBe(present);
      const before = queries;
      const sections = await workbench.navigationTrees.getSections(retainedOwner);
      expect(sections.flatMap((section) => section.nodes).map((node) => node.label)).toEqual(
        present ? ["Linked session"] : [],
      );
      expect(queries - before).toBe(present ? 1 : 0);
      expect(await workbench.commands.executeCommand("acme.consumer.command.ping")).toBe("available");
    }
    expect(queries).toBe(2);
  } finally {
    registration?.dispose();
    workbench.dispose();
  }
});
