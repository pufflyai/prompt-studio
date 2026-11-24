import { expect, test } from "bun:test";
import { accountEvents } from "@pstdio/sdk/extensions";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardAccountStatusQuery } from "@/lib/scoped-queries";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { publishExtensionEvent } from "@/shared/extensions/extension-webview-broadcast";
import { useCloudProjectChoice } from "./use-cloud-project-choice";

const until = async (ready: () => boolean) => {
  const deadline = Date.now() + 2000;
  while (!ready()) {
    if (Date.now() >= deadline) throw new Error("Cloud choice did not settle");
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
};

test.each([
  "accountId",
  "managerOrigin",
] as const)("a pending download cannot open a same-ID copy after the %s changes", async (changed) => {
  const id = "shared-project";
  const original = { managerOrigin: "https://accounts.example.test", accountId: "account-a" };
  const replacement =
    changed === "accountId"
      ? { ...original, accountId: "account-b" }
      : { ...original, managerOrigin: "https://new-accounts.example.test" };
  let active = original;
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const requestedAccounts: unknown[] = [];
  let opened = 0;
  let closed = 0;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      const account = active;
      if (url.pathname === "/v1/account")
        return Response.json({
          login: { ...account, deviceId: "device" },
          features: { relay: true },
          cloudProjects: [id],
          cloudProjectsLoaded: true,
          signInRequired: false,
        });
      if (url.pathname.endsWith("/download")) {
        requestedAccounts.push({
          accountId: url.searchParams.get("accountId"),
          managerOrigin: url.searchParams.get("managerOrigin"),
        });
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
              presence: active === original ? "cloud-only" : "downloaded",
              actions: { download: active === original, removeLocal: false, deleteCloud: false },
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
      <button disabled={!choice.canDownload} onClick={choice.requestDownload}>
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
    const staleAction = renderer!.root.findByType("button").props.onClick;
    await act(async () => {
      staleAction();
      await started.promise;
    });
    await act(async () => {
      active = replacement;
      owner
        .getWriter("projects")!
        .upsert({ id, name: "B's local copy", shorthand: "B", created_at: "2026-01-01", updated_at: "2026-01-01" });
      publishExtensionEvent({ id: accountEvents.changed.id }, owner);
      await until(() => status.getSnapshot().data?.login?.[changed] === replacement[changed]);
    });
    await act(async () =>
      until(() =>
        client
          .getQueriesData({ queryKey: ["cloud-project-catalog"] })
          .some(
            ([, value]) => (value as { account?: typeof replacement })?.account?.[changed] === replacement[changed],
          ),
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
    await act(async () => {
      staleAction();
      await until(() =>
        client
          .getMutationCache()
          .getAll()
          .every((mutation) => mutation.state.status !== "pending"),
      );
    });
    expect({ requestedAccounts, opened, closed }).toEqual({
      requestedAccounts: [original],
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
  "downloading",
  "downloaded",
  "folder error",
  "cloud-only",
] as const)("two views recover one copy after a lost response when the device reports %s", async (outcome) => {
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
        if (downloads > 1) {
          presence = "downloading";
          downloadError = undefined;
          return Response.json({ projectId: id, presence });
        }
        presence = outcome === "folder error" ? "downloading" : outcome;
        if (outcome === "folder error") downloadError = "Could not prepare the project folder";
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
  let peer: ReturnType<typeof useCloudProjectChoice>;
  const Probe = ({ other }: { other?: boolean }) => {
    const state = useCloudProjectChoice(input);
    if (other) peer = state;
    else choice = state;
    return null;
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
      peerRenderer = create(
        <QueryClientProvider client={client}>
          <Probe other />
        </QueryClientProvider>,
      );
    });
    await act(async () => until(() => choice?.canDownload && peer?.canDownload));
    const stalePeerAction = peer!.requestDownload;
    expect(opened).toEqual([]);
    await act(async () => {
      choice.requestDownload();
      await started.promise;
    });
    expect(peer!.showProgress).toBe(true);
    expect(peer!.canDownload).toBe(false);
    await act(async () => {
      peer!.requestDownload();
      release.resolve();
    });
    const shouldRetry = outcome === "folder error" || outcome === "cloud-only";
    if (outcome === "cloud-only") {
      await act(async () => until(() => Boolean(choice.discardDownload)));
      await act(async () => choice.discardDownload?.());
    }
    // A retired recovery claim must not make an already-admitted copy eligible again.
    await act(async () =>
      until(() => peer!.entry?.presence === presence && !choice.downloadBlocking && !peer!.downloadBlocking),
    );
    expect(downloads).toBe(1);
    if (shouldRetry) {
      expect(peer!.canDownload).toBe(true);
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
    await act(async () => peerRenderer?.unmount());
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
    });
    expect(opened).toEqual([
      {
        command: dashboardCommandIds.selectProject,
        args: { project: { id, name: "Recovered notes" } },
      },
    ]);
    expect(closed).toBe(1);
    expect(downloads).toBe(shouldRetry ? 2 : 1);
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
