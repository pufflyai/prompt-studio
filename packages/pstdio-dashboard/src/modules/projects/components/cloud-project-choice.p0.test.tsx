import { expect, test } from "bun:test";
import { accountEvents } from "@pstdio/sdk/extensions";
import { createWorkbenchStore } from "@pstdio/workbench";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, useEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardAccountStatusQuery } from "@/lib/scoped-queries";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { publishExtensionEvent } from "@/shared/extensions/extension-webview-broadcast";
import { useCloudProjectChoice } from "./use-cloud-project-choice";

const workbenchActivation = (active = true) => {
  const store = createWorkbenchStore({ name: "cloud-choice-test", initialState: { active } });
  return {
    store,
    isActive: () => store.getState().active,
    setActive: (next: boolean) => store.setState({ active: next }),
  };
};

const until = async (ready: () => boolean) => {
  const deadline = Date.now() + 2000;
  while (!ready()) {
    if (Date.now() >= deadline) throw new Error("Cloud choice did not settle");
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
};

test("an old account's pending download cannot open the new account's same-ID copy", async () => {
  const id = "shared-project";
  let active = "account-a";
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let requestedAccount: string | null = null;
  let opened = 0;
  let closed = 0;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      const account = { managerOrigin: "https://accounts.example.test", accountId: active };
      if (url.pathname === "/v1/account")
        return Response.json({
          login: { ...account, deviceId: "device" },
          features: { relay: true },
          cloudProjects: [id],
          cloudProjectsLoaded: true,
          signInRequired: false,
        });
      if (url.pathname.endsWith("/download")) {
        requestedAccount = url.searchParams.get("accountId");
        started.resolve();
        await release.promise;
        return Response.json({ projectId: id, presence: "downloading" });
      }
      if (url.pathname === "/v1/account/projects")
        return Response.json({
          account,
          membershipKnown: true,
          deletions: [],
          projects: [
            {
              id,
              name: "Shared notes",
              online: true,
              presence: active === "account-a" ? "cloud-only" : "downloaded",
              actions: { download: active === "account-a", removeLocal: false, deleteCloud: false },
            },
          ],
        });
      return Response.json({ state: "synced", offlineReady: true });
    },
  });
  const runtime = globalThis as typeof globalThis & {
    __PSTDIO_CONFIG__?: { apiBaseUrl: string };
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };
  const previous = runtime.__PSTDIO_CONFIG__;
  const previousAct = runtime.IS_REACT_ACT_ENVIRONMENT;
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
  runtime.IS_REACT_ACT_ENVIRONMENT = true;
  const owner = getRuntimeCollections();
  const client = getDashboardQueryClient(owner);
  const status = getDashboardAccountStatusQuery(owner);
  const input = {
    instance: { instanceId: "choice", resource: { id }, title: "Shared notes" },
    workbench: {
      activation: workbenchActivation(),
      overlays: {
        closeOverlay() {
          closed++;
        },
      },
      commands: {
        async executeCommand() {
          opened++;
        },
      },
    },
  } as unknown as WorkbenchPanelRenderInput;
  const Probe = () => {
    const choice = useCloudProjectChoice(input);
    return (
      <button disabled={!choice.entry?.actions.download} onClick={choice.requestDownload}>
        Download
      </button>
    );
  };
  let renderer: ReactTestRenderer | undefined;
  try {
    await status.read();
    await act(async () => {
      renderer = create(
        <QueryClientProvider client={client}>
          <Probe />
        </QueryClientProvider>,
      );
    });
    await act(async () =>
      until(() =>
        renderer!.root
          .findAllByType("button")
          .some((node) => node.props.children === "Download" && !node.props.disabled),
      ),
    );
    await act(async () => {
      renderer!.root
        .findAllByType("button")
        .find((node) => node.props.children === "Download")!
        .props.onClick();
      await started.promise;
    });
    await act(async () => {
      active = "account-b";
      owner
        .getWriter("projects")!
        .upsert({ id, name: "B's local copy", shorthand: "B", created_at: "2026-01-01", updated_at: "2026-01-01" });
      publishExtensionEvent({ id: accountEvents.changed.id }, owner);
      await until(() => status.getSnapshot().data?.login?.accountId === "account-b");
    });
    await act(async () =>
      until(() =>
        client
          .getQueriesData({ queryKey: ["cloud-project-catalog"] })
          .some(([, value]) => (value as { account?: { accountId: string } })?.account?.accountId === "account-b"),
      ),
    );
    await act(async () => {
      release.resolve();
      await until(
        () =>
          !client
            .getMutationCache()
            .getAll()
            .some((mutation) => mutation.state.status === "pending"),
      );
    });
    expect({ requestedAccount: String(requestedAccount), opened, closed }).toEqual({
      requestedAccount: "account-a",
      opened: 0,
      closed: 1,
    });
  } finally {
    release.resolve();
    await act(async () => renderer?.unmount());
    client.clear();
    await owner.dispose();
    runtime.__PSTDIO_CONFIG__ = previous;
    runtime.IS_REACT_ACT_ENVIRONMENT = previousAct;
    await server.stop(true);
  }
});

test.each([
  [false, false],
  [true, false],
  [false, true],
])("two views recover the same copy after a lost download response (folder error %p, peer mounted %p)", async (folderError, peerMounted) => {
  const id = "recovered-project";
  const account = { managerOrigin: "https://accounts.example.test", accountId: "account-a" };
  let presence = "cloud-only";
  let downloadError: string | undefined;
  let downloads = 0;
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const opened: unknown[] = [];
  let closed = 0;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/v1/account")
        return Response.json({
          login: { ...account, deviceId: "device" },
          features: { relay: true },
          cloudProjects: [id],
          cloudProjectsLoaded: true,
          signInRequired: false,
        });
      if (url.pathname.endsWith("/download")) {
        downloads++;
        started.resolve();
        await release.promise;
        presence = "downloading";
        if (downloads > 1) {
          downloadError = undefined;
          return Response.json({ projectId: id, presence });
        }
        if (folderError) downloadError = "Could not prepare the project folder";
        return Response.json({ error: "Download response lost" }, { status: 503 });
      }
      if (url.pathname === "/v1/account/projects")
        return Response.json({
          account,
          membershipKnown: true,
          deletions: [],
          projects: [
            {
              id,
              name: "Recovered notes",
              online: true,
              presence,
              downloadError,
              actions: { download: presence !== "downloaded", removeLocal: false, deleteCloud: false },
            },
          ],
        });
      return Response.json({ state: "synced", offlineReady: true });
    },
  });
  const runtime = globalThis as typeof globalThis & {
    __PSTDIO_CONFIG__?: { apiBaseUrl: string };
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };
  const previous = runtime.__PSTDIO_CONFIG__;
  const previousAct = runtime.IS_REACT_ACT_ENVIRONMENT;
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
  runtime.IS_REACT_ACT_ENVIRONMENT = true;
  const owner = getRuntimeCollections();
  const client = getDashboardQueryClient(owner);
  const input = {
    instance: { instanceId: "choice", resource: { id }, title: "Recovered notes" },
    workbench: {
      activation: workbenchActivation(),
      overlays: {
        closeOverlay() {
          closed++;
        },
      },
      commands: {
        async executeCommand(command: string, args: unknown) {
          opened.push({ command, args });
        },
      },
    },
  } as unknown as WorkbenchPanelRenderInput;
  const peerInput = { ...input, instance: { ...input.instance, instanceId: "peer-choice" } };
  let choice: ReturnType<typeof useCloudProjectChoice>;
  let peer: ReturnType<typeof useCloudProjectChoice>;
  const Probe = ({ other }: { other?: boolean }) => {
    const state = useCloudProjectChoice(other ? peerInput : input);
    if (other) peer = state;
    else choice = state;
    return null;
  };
  let readySetups = 0;
  const ReadyProbe = () => {
    useEffect(() => {
      readySetups++;
    }, []);
    return <Probe />;
  };
  let renderer: ReactTestRenderer | undefined;
  let peerRenderer: ReactTestRenderer | undefined;
  try {
    await getDashboardAccountStatusQuery(owner).read();
    await act(async () => {
      renderer = create(
        <QueryClientProvider client={client}>
          <Probe />
        </QueryClientProvider>,
      );
    });
    await act(async () => until(() => Boolean(choice.entry?.actions.download)));
    expect(opened).toEqual([]);
    await act(async () => {
      choice.requestDownload();
      await started.promise;
    });
    await act(async () => {
      peerRenderer = create(
        <QueryClientProvider client={client}>
          <Probe other />
        </QueryClientProvider>,
      );
    });
    expect(peer!.showProgress).toBe(true);
    expect(peer!.canDownload).toBe(false);
    const stalePeerAction = peer!.requestDownload;
    await act(async () => {
      stalePeerAction();
      release.resolve();
      await until(() => peer!.entry?.presence === "downloading" && !choice.downloadBlocking && !peer!.downloadBlocking);
    });
    expect(downloads).toBe(1);
    if (folderError) {
      await act(async () => until(() => choice.canDownload && peer!.canDownload));
      expect(downloads).toBe(1);
      await act(async () => {
        choice.requestDownload();
        await until(() => downloads === 2);
      });
    } else {
      expect(peer!.canDownload).toBe(false);
      await act(async () => {
        stalePeerAction();
        await until(() =>
          client
            .getMutationCache()
            .getAll()
            .every((mutation) => mutation.state.status !== "pending"),
        );
      });
      expect(downloads).toBe(1);
    }
    if (!peerMounted) await act(async () => peerRenderer?.unmount());
    await act(async () => {
      presence = "downloaded";
      owner.getWriter("projects")!.upsert({
        id,
        name: "Recovered notes",
        shorthand: "R",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      });
      publishExtensionEvent({ id: accountEvents.changed.id }, owner);
      await until(() => choice.entry?.presence === "downloaded");
      if (peerMounted) await until(() => peer!.entry?.presence === "downloaded");
    });
    expect(opened).toEqual([
      {
        command: dashboardCommandIds.selectProject,
        args: { project: { id, name: "Recovered notes" } },
      },
    ]);
    expect(closed).toBe(peerMounted ? 2 : 1);
    expect(downloads).toBe(folderError ? 2 : 1);

    await act(async () => {
      owner.getWriter("projects")!.upsert({
        id,
        name: "Renamed notes",
        shorthand: "R",
        created_at: "2026-01-01",
        updated_at: "2026-01-02",
      });
    });
    expect(opened).toHaveLength(1);
    expect(closed).toBe(peerMounted ? 2 : 1);

    await act(async () => {
      renderer?.unmount();
      peerRenderer?.unmount();
    });
    await act(async () => {
      renderer = create(
        <StrictMode>
          <QueryClientProvider client={client}>
            <ReadyProbe />
          </QueryClientProvider>
        </StrictMode>,
      );
    });
    expect(readySetups).toBe(2);
    expect(opened).toHaveLength(2);
    expect(opened[1]).toEqual({
      command: dashboardCommandIds.selectProject,
      args: { project: { id, name: "Renamed notes" } },
    });

    await act(async () => {
      peerRenderer = create(
        <QueryClientProvider client={client}>
          <Probe other />
        </QueryClientProvider>,
      );
    });
    expect(peer!.entry?.presence).toBe("downloaded");
    expect(opened).toHaveLength(2);
  } finally {
    release.resolve();
    await act(async () => {
      renderer?.unmount();
      peerRenderer?.unmount();
    });
    client.clear();
    await owner.dispose();
    runtime.__PSTDIO_CONFIG__ = previous;
    runtime.IS_REACT_ACT_ENVIRONMENT = previousAct;
    await server.stop(true);
  }
});

test.each([
  "rejected",
  "inactive",
  "reactivated",
  "removing",
] as const)("a ready recovery gives navigation to an available view after %s", async (mode) => {
  const id = "ready-project";
  const account = { managerOrigin: "https://accounts.example.test", accountId: "account" };
  let presence = "downloaded";
  const rejectFirst = mode === "rejected" || mode === "removing";
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const { pathname } = new URL(request.url);
      if (pathname === "/v1/account")
        return Response.json({
          login: { ...account, deviceId: "device" },
          cloudProjects: [id],
          cloudProjectsLoaded: true,
        });
      if (pathname === "/v1/account/projects")
        return Response.json({
          account,
          deletions: [],
          projects: [{ id, name: "Ready notes", presence, actions: { download: false } }],
        });
      return Response.json({ error: "Unexpected request" }, { status: 404 });
    },
  });
  const runtime = globalThis as typeof globalThis & {
    __PSTDIO_CONFIG__?: { apiBaseUrl: string };
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };
  const previous = runtime.__PSTDIO_CONFIG__;
  const previousAct = runtime.IS_REACT_ACT_ENVIRONMENT;
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
  runtime.IS_REACT_ACT_ENVIRONMENT = true;
  const owner = getRuntimeCollections();
  const client = getDashboardQueryClient(owner);
  const firstActivation = workbenchActivation(rejectFirst);
  const release = Promise.withResolvers<void>();
  const calls: string[] = [];
  const selected: string[] = [];
  const closed: string[] = [];
  const observedPresence = new Map<string, string>();
  const createInput = (instanceId: string, activation = workbenchActivation()) =>
    ({
      instance: { instanceId, resource: { id }, title: "Ready notes" },
      workbench: {
        activation,
        overlays: { closeOverlay: () => closed.push(instanceId) },
        commands: {
          async executeCommand(command: string) {
            expect(command).toBe(dashboardCommandIds.selectProject);
            calls.push(instanceId);
            if (!activation.isActive()) return;
            if (rejectFirst && instanceId === "first") {
              await release.promise;
              throw new Error("Selection persistence failed");
            }
            selected.push(instanceId);
          },
        },
      },
    }) as unknown as WorkbenchPanelRenderInput;
  const first = createInput("first", firstActivation);
  const peer = createInput("peer");
  const Probe = ({ input }: { input: WorkbenchPanelRenderInput }) => {
    const choice = useCloudProjectChoice(input);
    if (choice.entry) observedPresence.set(input.instance.instanceId, choice.entry.presence);
    return null;
  };
  const renderers: ReactTestRenderer[] = [];
  const mount = async (input: WorkbenchPanelRenderInput) => {
    await act(async () => {
      renderers.push(
        create(
          <QueryClientProvider client={client}>
            <Probe input={input} />
          </QueryClientProvider>,
        ),
      );
    });
    await act(async () => until(() => observedPresence.get(input.instance.instanceId) === "downloaded"));
  };
  try {
    await getDashboardAccountStatusQuery(owner).read();
    owner.getWriter("projects")!.upsert({
      id,
      name: "Ready notes",
      shorthand: "R",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    });
    await mount(first);
    expect(calls).toEqual(rejectFirst ? ["first"] : []);
    if (mode === "reactivated") {
      await act(async () => firstActivation.setActive(true));
      expect(selected).toEqual(["first"]);
    }
    await mount(peer);
    if (mode === "removing") {
      await act(async () => {
        presence = "removing";
        publishExtensionEvent({ id: accountEvents.changed.id }, owner);
        await until(() => observedPresence.get("peer") === "removing");
      });
      await act(async () => release.resolve());
      expect(calls).toEqual(["first"]);
      expect(closed).toEqual(["first"]);
      expect(selected).toEqual([]);
      return;
    }
    if (mode === "rejected") {
      expect(calls).toEqual(["first"]);
      expect(closed).toEqual(["first"]);
      await act(async () => {
        release.resolve();
        await until(() => selected.includes("peer"));
      });
    }
    expect(selected).toEqual([mode === "reactivated" ? "first" : "peer"]);
    if (mode === "inactive") {
      expect(closed).toEqual(["peer"]);
      expect(calls).toEqual(["peer"]);
    }
  } finally {
    release.resolve();
    await act(async () => {
      for (const renderer of renderers) renderer.unmount();
    });
    client.clear();
    await owner.dispose();
    runtime.__PSTDIO_CONFIG__ = previous;
    runtime.IS_REACT_ACT_ENVIRONMENT = previousAct;
    await server.stop(true);
  }
});

test.each([false, true])("team choice follows native recovery and scope retirement (revoked %s)", async (revoked) => {
  const id = "recovered-project";
  const account = { managerOrigin: "https://accounts.example.test", accountId: "account-a" };
  const projectAccount = { ...account, accountId: "team" };
  const initialPresence = "downloading";
  let presence = initialPresence;
  let downloads = 0;
  let admitted = true;
  const syncReads: Record<string, string>[] = [];
  const opened: unknown[] = [];
  let closed = 0;
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/v1/account")
        return Response.json({
          login: { ...account, deviceId: "device", relayOrigin: "https://relay.example.test" },
          teamProjectOwners: { [id]: projectAccount.accountId },
          teamProjects: admitted ? { [id]: projectAccount.accountId } : {},
          teamAccounts: admitted
            ? [{ accountId: projectAccount.accountId, name: "Team", role: "member", features: { relay: true } }]
            : [],
          features: { relay: true },
          cloudProjects: [],
          cloudProjectsLoaded: true,
          signInRequired: false,
        });
      if (url.pathname.endsWith("/download")) {
        downloads++;
        presence = "downloading";
        return Response.json({ error: "Download response lost" }, { status: 503 });
      }
      if (url.pathname === "/v1/account/projects") {
        expect(url.searchParams.get("accountId")).toBe(projectAccount.accountId);
        return Response.json({
          account: projectAccount,
          membershipKnown: true,
          deletions: [],
          projects: [
            {
              id,
              name: "Recovered notes",
              online: true,
              presence,
              actions: { download: presence !== "downloaded", removeLocal: false, deleteCloud: false },
            },
          ],
        });
      }
      if (url.pathname.endsWith("/sync")) {
        syncReads.push(Object.fromEntries(url.searchParams));
        return Response.json({ state: "synced", offlineReady: true });
      }
      return Response.json({ error: "Unexpected request" }, { status: 404 });
    },
  });
  const runtime = globalThis as typeof globalThis & {
    __PSTDIO_CONFIG__?: { apiBaseUrl: string };
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };
  const previous = runtime.__PSTDIO_CONFIG__;
  const previousAct = runtime.IS_REACT_ACT_ENVIRONMENT;
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
  runtime.IS_REACT_ACT_ENVIRONMENT = true;
  const owner = getRuntimeCollections();
  const client = getDashboardQueryClient(owner);
  const input = {
    instance: {
      instanceId: "choice",
      resource: { id },
      title: "Recovered notes",
      pageContext: { params: { accountId: projectAccount.accountId } },
    },
    workbench: {
      activation: workbenchActivation(),
      overlays: {
        closeOverlay() {
          closed++;
        },
      },
      commands: {
        async executeCommand(command: string, args: unknown) {
          opened.push({ command, args });
        },
      },
    },
  } as unknown as WorkbenchPanelRenderInput;
  let choice: ReturnType<typeof useCloudProjectChoice>;
  const Probe = () => {
    choice = useCloudProjectChoice(input);
    return null;
  };
  let renderer: ReactTestRenderer | undefined;
  try {
    await getDashboardAccountStatusQuery(owner).read();
    await act(async () => {
      renderer = create(
        <QueryClientProvider client={client}>
          <Probe />
        </QueryClientProvider>,
      );
    });
    await act(async () => until(() => choice.entry?.presence === initialPresence));
    expect(opened).toEqual([]);
    await act(async () => {
      owner.getWriter("projects")!.upsert({
        id,
        name: "Recovered notes",
        shorthand: "R",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      });
    });
    await act(async () => until(() => syncReads.length > 0));
    expect(syncReads).toEqual([account]);
    expect(opened).toEqual([]);
    if (revoked) {
      await act(async () => {
        admitted = false;
        publishExtensionEvent({ id: accountEvents.changed.id }, owner);
        await getDashboardAccountStatusQuery(owner).read();
      });
      expect(choice!.invalidated).toBe(true);
      expect(choice!.entry).toBeUndefined();
      expect(opened).toEqual([]);
      expect(closed).toBe(1);
      expect(downloads).toBe(0);
      return;
    }
    await act(async () => {
      presence = "downloaded";
      publishExtensionEvent({ id: accountEvents.changed.id }, owner);
      await until(() => choice.entry?.presence === "downloaded");
    });
    expect(opened).toEqual([
      {
        command: dashboardCommandIds.selectProject,
        args: { project: { id, name: "Recovered notes" } },
      },
    ]);
    expect(closed).toBe(1);
    expect(downloads).toBe(0);
  } finally {
    await act(async () => renderer?.unmount());
    client.clear();
    await owner.dispose();
    runtime.__PSTDIO_CONFIG__ = previous;
    runtime.IS_REACT_ACT_ENVIRONMENT = previousAct;
    await server.stop(true);
  }
});

test("sign-in-required membership does not expose ordinary project deletion", async () => {
  const server = Bun.serve({
    port: 0,
    fetch: () =>
      Response.json({
        login: null,
        signInRequired: true,
        features: null,
        cloudProjects: [],
        cloudProjectsLoaded: false,
      }),
  });
  const runtime = globalThis as typeof globalThis & { __PSTDIO_CONFIG__?: { apiBaseUrl: string } };
  const previous = runtime.__PSTDIO_CONFIG__;
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
  const owner = getRuntimeCollections();
  const client = getDashboardQueryClient(owner);
  try {
    await getDashboardAccountStatusQuery(owner).read();
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { WorkbenchThemeProvider } = await import("@pstdio/workbench/react");
    const { ProjectDangerZone } = await import("../../settings/components/project-danger-zone");
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <WorkbenchThemeProvider>
          <ProjectDangerZone projectId="local-copy" />
        </WorkbenchThemeProvider>
      </QueryClientProvider>,
    );
    expect(markup.includes('data-testid="project-danger-zone-card"')).toBe(false);
  } finally {
    client.clear();
    await owner.dispose();
    runtime.__PSTDIO_CONFIG__ = previous;
    await server.stop(true);
  }
});
