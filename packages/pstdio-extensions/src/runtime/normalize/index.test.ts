import { describe, expect, test } from "bun:test";
import { commandEvent, commandRef, defineExtension, packageAsset } from "@pstdio/sdk/extensions";
import type { LoadedExtensionSource } from "../loader";
import { normalizeExtensionSources } from "./index";

const wrap = (definition: ReturnType<typeof defineExtension>): LoadedExtensionSource => ({
  sourcePath: `/fake/${definition.namespace}/extension.ts`,
  sourceKind: "local",
  definition,
});

describe("normalizeExtensionSources", () => {
  test("registers commands with namespace-scoped CLI paths", () => {
    const planner = defineExtension({
      id: "pstdio.planner",
      namespace: "planner",
      name: "Planner",
      commands: {
        "tickets.create": {
          title: "Create ticket",
          cli: true,
          run: async () => undefined,
        },
      },
    });

    const runtime = normalizeExtensionSources([wrap(planner)]);
    expect(runtime.diagnostics).toEqual([]);
    expect(runtime.commands).toHaveLength(1);
    expect(runtime.commands[0]).toMatchObject({
      id: "planner.tickets.create",
      localId: "tickets.create",
      extensionId: "pstdio.planner",
      namespace: "planner",
      title: "Create ticket",
    });
    expect(runtime.cli).toHaveLength(1);
    expect(runtime.cli[0]).toMatchObject({
      namespace: "planner",
      path: ["tickets", "create"],
      pathKey: "planner tickets create",
    });
  });

  test("uses custom CLI path when provided", () => {
    const planner = defineExtension({
      id: "pstdio.planner",
      namespace: "planner",
      name: "Planner",
      commands: {
        "tickets.create": {
          title: "Create ticket",
          cli: { path: ["tickets", "new"] },
          run: async () => undefined,
        },
      },
    });

    const runtime = normalizeExtensionSources([wrap(planner)]);
    expect(runtime.cli[0]?.path).toEqual(["tickets", "new"]);
  });

  test("flags duplicate command ids and CLI collisions", () => {
    const a = defineExtension({
      id: "pstdio.planner",
      namespace: "planner",
      name: "Planner",
      commands: {
        "tickets.create": { title: "A", cli: true, run: async () => undefined },
      },
    });
    const b = defineExtension({
      id: "pstdio.planner",
      namespace: "planner",
      name: "Planner Duplicate",
      commands: {
        "tickets.create": { title: "B", cli: true, run: async () => undefined },
      },
    });

    const runtime = normalizeExtensionSources([wrap(a), wrap(b)]);
    const codes = runtime.diagnostics.map((d) => d.code);
    expect(codes).toContain("duplicate_extension_id");
    expect(codes).toContain("duplicate_command_id");
    expect(codes).toContain("duplicate_cli_path");
  });

  test("registers middlewares against typed command refs", () => {
    const labAwaken = commandRef("lab.awaken");
    const lab = defineExtension({
      id: "pstdio.extension-lab",
      namespace: "lab",
      name: "Lab",
      commands: {
        awaken: { title: "Awaken", run: async () => undefined },
      },
      middlewares: {
        rejectSentience: {
          command: labAwaken,
          handler: async () => undefined,
        },
      },
    });

    const runtime = normalizeExtensionSources([wrap(lab)]);
    expect(runtime.middlewares).toHaveLength(1);
    expect(runtime.middlewares[0]).toMatchObject({
      id: "lab.rejectSentience",
      commandId: "lab.awaken",
    });
  });

  test("registers hooks against event refs and command lifecycle events", () => {
    const labAwaken = commandRef("lab.awaken");
    const lab = defineExtension({
      id: "pstdio.extension-lab",
      namespace: "lab",
      name: "Lab",
      commands: {
        awaken: { title: "Awaken", run: async () => undefined },
      },
      hooks: {
        onRejected: {
          event: commandEvent(labAwaken, "rejected"),
          handler: async () => undefined,
        },
      },
    });

    const runtime = normalizeExtensionSources([wrap(lab)]);
    expect(runtime.hooks).toHaveLength(1);
    expect(runtime.hooks[0]?.eventId).toBe("command.rejected:lab.awaken");
  });

  test("registers artifact mounts under .pstdio/<namespace>/", () => {
    const planner = defineExtension({
      id: "pstdio.planner",
      namespace: "planner",
      name: "Planner",
      artifactMounts: {
        tickets: { path: "tickets", label: "Tickets" },
      },
    });

    const runtime = normalizeExtensionSources([wrap(planner)]);
    expect(runtime.artifactMounts[0]).toMatchObject({
      relativePath: "tickets",
      fullPath: ".pstdio/planner/tickets",
    });
  });

  test("rejects artifact mounts that escape the namespace", () => {
    const bad = defineExtension({
      id: "pstdio.bad",
      namespace: "bad",
      name: "Bad",
      artifactMounts: {
        escape: { path: "../escape", label: "Escape" },
      },
    });

    const runtime = normalizeExtensionSources([wrap(bad)]);
    expect(runtime.artifactMounts).toEqual([]);
    expect(runtime.diagnostics.map((d) => d.code)).toContain("unsafe_artifact_mount_path");
  });

  test("rejects invalid extension id format", () => {
    const bad = defineExtension({
      id: "Bad Id With Spaces",
      namespace: "bad",
      name: "Bad",
    });

    const runtime = normalizeExtensionSources([wrap(bad)]);
    expect(runtime.diagnostics.map((d) => d.code)).toContain("invalid_extension_id");
    expect(runtime.extensions).toEqual([]);
  });

  test("collects templates and skills with package assets", () => {
    const planner = defineExtension({
      id: "pstdio.planner",
      namespace: "planner",
      name: "Planner",
      templateTypes: {
        ticket: { label: "Ticket" },
      },
      templates: {
        defaultTicket: {
          title: "Default Ticket",
          type: "ticket",
          source: packageAsset("./templates/default.md", "file:///fake/extension.ts"),
        },
      },
      skills: {
        triage: {
          title: "Triage",
          source: packageAsset("./skills/triage.md", "file:///fake/extension.ts"),
        },
      },
    });

    const runtime = normalizeExtensionSources([wrap(planner)]);
    expect(runtime.templateTypes).toHaveLength(1);
    expect(runtime.templates).toHaveLength(1);
    expect(runtime.skills).toHaveLength(1);
  });
});
