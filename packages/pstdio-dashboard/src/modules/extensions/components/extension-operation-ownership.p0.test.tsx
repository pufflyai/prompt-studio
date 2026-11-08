import { expect, test } from "bun:test";
import type { MarketplaceExtension, ProjectExtensionInstance } from "@pstdio/sdk/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
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

test("install, toggle and batch upgrades share catalog owners while only two upgrades are active", async () => {
  const targets = [installed("one"), installed("two"), installed("three")];
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
    controls = useExtensionPanelActions("project");
    return null;
  };
  const owner = getExtensionActions(client, "project");
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
    await controls.handleToggle(targets[0]!, false);
    expect(Object.keys(owner.getSnapshot().actions)).toEqual(["one"]);
    const updated = resolveExtensionAction(owner.getSnapshot().actions, targets[0]!);
    owner.dismiss(installation.key, installation.action);
    expect(resolveExtensionAction(owner.getSnapshot().actions, targets[0]!).action).toBe(updated.action);
    owner.dismiss(updated.key, updated.action);
    expect(resolveExtensionAction(owner.getSnapshot().actions, targets[0]!).action).toBeUndefined();

    const batch = controls.handleUpgradeAll(targets);
    await until(() => started.length === 2);
    expect(owner.getSnapshot().batch?.ids).toEqual(["one", "two", "three"]);
    expect(Object.values(owner.getSnapshot().actions).filter((entry) => entry.status === "running")).toHaveLength(2);
    expect(resolveExtensionAction(owner.getSnapshot().actions, targets[2]!).action?.status).toBe("queued");
    expect(await controls.handleUpgrade(targets[0]!)).toBe(false);
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
    // A batch excludes an already active individual operation under the same catalog key.
    const individual = controls.handleUpgrade(targets[0]!);
    const overlapping = controls.handleUpgradeAll(targets);
    expect(owner.getSnapshot().batch?.ids).toEqual(["two", "three"]);
    await Promise.all([individual, overlapping]);
    expect(owner.getSnapshot().batch).toMatchObject({ completed: 2, failed: 0 });
  } finally {
    for (const gate of gates) gate.resolve();
    globals.__PSTDIO_CONFIG__ = previous;
    client.clear();
    await server.stop(true);
  }
});
