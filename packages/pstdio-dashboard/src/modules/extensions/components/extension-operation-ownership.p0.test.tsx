import { expect, test } from "bun:test";
import type { MarketplaceExtension, ProjectExtensionInstance } from "@pstdio/sdk/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { getProjectExtensionQueries } from "@/shared/extensions/project-extension-queries";
import { getExtensionActions, resolveExtensionAction } from "./extension-actions";
import { useExtensionPanelActions } from "./use-extension-panel-actions";

const installed = (name: string): ProjectExtensionInstance => ({
  id: `${name}-instance`,
  projectId: "project",
  extensionId: `example.${name}`,
  installedExtensionId: `${name}-source`,
  installName: name,
  name,
  displayName: name,
  sourcePath: `/extensions/${name}`,
  scope: "global",
  status: "loaded",
  enabled: true,
  config: {},
  canUpgrade: true,
  updateAvailable: false,
});

test("installs hand off to the exact instance and same-name upgrades respect host capacity", async () => {
  const targets = [installed("one"), { ...installed("two"), installName: "one" }, installed("three")];
  const gates = targets.map(() => Promise.withResolvers<void>());
  const started: string[] = [];
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: async (request) => {
      const path = new URL(request.url).pathname;
      if (path.endsWith("/upgrade")) {
        const index = targets.findIndex((entry) => path.includes(entry.id));
        started.push(targets[index]!.installName);
        await gates[index]!.promise;
        return Response.json({ changed: true, extension: { ...targets[index]!, canUpgrade: false } });
      }
      if (request.method === "POST" && path === "/v1/projects/project/extensions/install")
        return Response.json({ extension: targets[0] });
      if (request.method === "PATCH" && path === "/v1/projects/project/extensions/one-instance")
        return Response.json(targets[0]);
      return Response.json({ error: `Unexpected request: ${request.method} ${path}` }, { status: 404 });
    },
  });
  const globals = globalThis as unknown as { __PSTDIO_CONFIG__?: { apiBaseUrl: string } };
  const previous = globals.__PSTDIO_CONFIG__;
  globals.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
  const client = new QueryClient();
  client.setQueryData(["project-extensions", "project"], { extensions: [], marketplace: [] });
  let controls!: ReturnType<typeof useExtensionPanelActions>;
  const Probe = () => {
    controls = useExtensionPanelActions("project", 2);
    return null;
  };
  const owner = getExtensionActions(getProjectExtensionQueries("project").extensions);
  const until = async (ready: () => boolean) => {
    while (!ready()) await new Promise<void>((resolve) => setImmediate(resolve));
  };
  try {
    renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
    const available: MarketplaceExtension = {
      installName: "one",
      displayName: "one",
      description: "",
      installed: false,
      origin: { kind: "git", url: "https://example.com/tools", ref: "main", path: "one" },
    };
    await controls.handleInstall(available);
    const installation = resolveExtensionAction(owner.getSnapshot().actions, targets[0]!);
    expect(installation.action?.status).toBe("success");
    expect(resolveExtensionAction(owner.getSnapshot().actions, targets[1]!).action).toBeUndefined();
    await controls.handleToggle(targets[0]!, false);
    expect(Object.keys(owner.getSnapshot().actions)).toEqual(["one-instance"]);
    const updated = resolveExtensionAction(owner.getSnapshot().actions, targets[0]!);
    owner.dismiss(installation.key, installation.action);
    expect(resolveExtensionAction(owner.getSnapshot().actions, targets[0]!).action).toBe(updated.action);
    owner.dismiss(updated.key, updated.action);
    expect(resolveExtensionAction(owner.getSnapshot().actions, targets[0]!).action).toBeUndefined();

    const batch = controls.handleUpgradeAll(targets);
    await until(() => started.length === 2);
    expect(owner.getSnapshot().batch?.ids).toEqual(targets.map(({ id }) => id));
    expect(Object.values(owner.getSnapshot().actions).filter((entry) => entry.status === "running")).toHaveLength(2);
    expect(resolveExtensionAction(owner.getSnapshot().actions, targets[2]!).action?.status).toBe("queued");
    expect(await controls.handleUpgrade(targets[0]!)).toBe(false);
    expect(await controls.handleUpgrade(targets[2]!)).toBe(false);
    expect(started).toHaveLength(2);
    gates[0]!.resolve();
    await until(() => started.length === 3);
    const completed = resolveExtensionAction(owner.getSnapshot().actions, targets[0]!);
    owner.dismiss(completed.key, completed.action);
    expect(owner.getSnapshot().batch?.completed).toBe(1);
    gates[1]!.resolve();
    gates[2]!.resolve();
    await batch;
    expect(owner.getSnapshot().batch).toMatchObject({ completed: 3, failed: 0 });
    expect(owner.getSnapshot().actions[targets[0]!.id]).toBeUndefined();
    expect(owner.getSnapshot().actions[targets[1]!.id]?.status).toBe("success");
    // A batch excludes an already active individual operation on the same instance.
    const individual = controls.handleUpgrade(targets[0]!);
    const overlapping = controls.handleUpgradeAll(targets);
    expect(owner.getSnapshot().batch?.ids).toEqual(targets.slice(1).map(({ id }) => id));
    await Promise.all([individual, overlapping]);
    expect(owner.getSnapshot().batch).toMatchObject({ completed: 2, failed: 0 });
  } finally {
    for (const gate of gates) gate.resolve();
    globals.__PSTDIO_CONFIG__ = previous;
    client.clear();
    await server.stop(true);
  }
});
