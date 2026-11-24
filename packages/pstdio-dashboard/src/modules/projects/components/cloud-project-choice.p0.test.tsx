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
import { useCloudLocalRemoval } from "../data/cloud-local-removal";
import { useCloudProjectDeletions } from "../data/cloud-project-deletion-operations";
import { cloudCatalogKeyFor } from "../data/project-catalog";
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
  "deviceId",
] as const)("a pending download cannot open a same-ID copy after the %s changes", async (changed) => {
  const id = "shared-project";
  const originalAccount = { managerOrigin: "https://accounts.example.test", accountId: "account-a" };
  const original = { ...originalAccount, deviceId: "old-device" };
  const next = { accountId: "account-b", managerOrigin: "https://new-accounts.example.test", deviceId: "new-device" };
  const replacement = { ...original, [changed]: next[changed] };
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
      const { deviceId, ...account } = active;
      if (url.pathname === "/v1/account")
        return Response.json({
          login: { ...account, deviceId },
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
    const replacementCatalog = cloudCatalogKeyFor(
      replacement.managerOrigin,
      replacement.accountId,
      replacement.deviceId,
    );
    await act(async () => until(() => Boolean(client.getQueryData(replacementCatalog))));
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
      requestedAccounts: [originalAccount],
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

const copyStates = [
  "downloading",
  "downloaded",
  "folder error",
  "sync error",
  "cloud-only",
  "deletion receipt",
  "removal receipt",
] as const;

const copyDevice = (outcome: (typeof copyStates)[number]) => {
  const id = "recovered-project";
  const account = { managerOrigin: "https://accounts.example.test", accountId: "account-a" };
  const folderError = "Could not prepare the project folder";
  const device: { presence: string; downloadError?: string; syncFailed: boolean; downloads: number } = {
    presence: outcome === "removal receipt" ? "downloading" : "cloud-only",
    syncFailed: outcome === "removal receipt",
    downloads: 0,
  };
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const removalStarted = Promise.withResolvers<void>();
  const releaseRemoval = Promise.withResolvers<void>();
  const download = async () => {
    device.downloads++;
    started.resolve();
    await release.promise;
    if (device.downloads > 1) {
      device.presence = "downloading";
      device.downloadError = undefined;
      device.syncFailed = false;
      return Response.json({ projectId: id, presence: device.presence });
    }
    device.presence = outcome === "folder error" || outcome === "sync error" ? "downloading" : outcome;
    if (outcome === "folder error") device.downloadError = folderError;
    if (outcome === "sync error") device.syncFailed = true;
    return Response.json({ error: "Download response lost" }, { status: 503 });
  };
  const deleteCloud = async () => {
    removalStarted.resolve();
    await releaseRemoval.promise;
    return Response.json({
      projectId: id,
      operationId: "deletion",
      state: "deleting",
      startedAt: "2026-01-01T00:00:00Z",
      completedAt: null,
    });
  };
  const removeLocal = async () => {
    removalStarted.resolve();
    await releaseRemoval.promise;
    return Response.json({ projectId: id, presence: "cloud-only" });
  };
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/v1/account")
        return Response.json({
          login: { ...account, deviceId: "device" },
          features: { relay: true },
          cloudProjects: [id],
          cloudProjectsLoaded: true,
          signInRequired: false,
        });
      if (url.pathname.endsWith("/download")) return download();
      if (url.pathname.endsWith("/delete-cloud")) return deleteCloud();
      if (url.pathname.endsWith("/remove-local")) return removeLocal();
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
              presence: device.presence,
              downloadError: device.downloadError,
              actions: {
                download: device.presence !== "downloaded",
                removeLocal: outcome === "removal receipt",
                deleteCloud: false,
              },
            },
          ],
        });
      return Response.json({
        state: device.syncFailed ? "needs-attention" : "first-download-incomplete",
        offlineReady: false,
      });
    },
  });
  return { id, account, device, folderError, server, started, release, removalStarted, releaseRemoval };
};

test.each(copyStates)("two views check the current device state before downloading (%s)", async (outcome) => {
  const { id, account, device, folderError, server, started, release, removalStarted, releaseRemoval } =
    copyDevice(outcome);
  const opened: unknown[] = [];
  let closed = 0;
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
  const mutationsSettled = () =>
    client
      .getMutationCache()
      .getAll()
      .every((mutation) => mutation.state.status !== "pending");
  const addLocalProject = () =>
    owner.getWriter("projects")!.upsert({
      id,
      name: "Recovered notes",
      shorthand: "R",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    });
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
  let deletions: ReturnType<typeof useCloudProjectDeletions>;
  let removal: ReturnType<typeof useCloudLocalRemoval>;
  const Probe = ({ other }: { other?: boolean }) => {
    const state = useCloudProjectChoice(input);
    deletions = useCloudProjectDeletions();
    removal = useCloudLocalRemoval();
    if (other) peer = state;
    else choice = state;
    return null;
  };
  let renderer: ReactTestRenderer | undefined;
  let peerRenderer: ReactTestRenderer | undefined;
  try {
    if (outcome === "removal receipt") addLocalProject();
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
    if (outcome === "deletion receipt" || outcome === "removal receipt") {
      release.resolve();
      let result: Promise<unknown>;
      await act(async () => {
        result =
          outcome === "deletion receipt"
            ? deletions.start(id, "Recovered notes", account)
            : removal.remove(id, "Recovered notes", account, false);
        await removalStarted.promise;
      });
      await act(async () => {
        stalePeerAction();
        await until(mutationsSettled);
      });
      expect(device.downloads).toBe(0);
      await act(async () => {
        releaseRemoval.resolve();
        await result!;
      });
      expect(removal!.active(id)).toBe(false);
      await act(async () => {
        stalePeerAction();
        await until(mutationsSettled);
      });
      expect(device.downloads).toBe(0);
      expect(peer!.entry?.presence).toBe("cloud-only");
      return;
    }
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
    const hasRetryableFailure = outcome === "folder error" || outcome === "sync error";
    const shouldRetry = hasRetryableFailure || outcome === "cloud-only";
    if (outcome === "sync error") {
      await act(async () => addLocalProject());
    }
    if (outcome === "cloud-only") {
      await act(async () => until(() => Boolean(choice.discardDownload)));
      await act(async () => choice.discardDownload?.());
    }
    // A retired recovery claim must not make an already-admitted copy eligible again.
    await act(async () =>
      until(() => peer!.entry?.presence === device.presence && !choice.downloadBlocking && !peer!.downloadBlocking),
    );
    expect(device.downloads).toBe(1);
    if (shouldRetry) {
      await act(async () => until(() => choice.canDownload && peer!.canDownload));
      const staleRetry = peer!.requestDownload;
      expect(peer!.canDownload).toBe(true);
      await act(async () => {
        choice.requestDownload();
        await until(() => device.downloads === 2 && mutationsSettled());
      });
      if (hasRetryableFailure) {
        await act(async () => {
          staleRetry();
          await until(mutationsSettled);
        });
        expect(device.downloads).toBe(2);
        if (outcome === "folder error") device.downloadError = folderError;
        else device.syncFailed = true;
        await act(async () => {
          await client.refetchQueries({
            queryKey: [outcome === "folder error" ? "cloud-project-catalog" : "cloud-project-opening"],
          });
          await until(() => choice.canDownload && peer!.canDownload);
        });
        await act(async () => {
          staleRetry();
          await until(mutationsSettled);
        });
        expect(device.downloads).toBe(2);
        await act(async () => {
          choice.requestDownload();
          await until(() => device.downloads === 3 && mutationsSettled());
        });
      }
    } else {
      expect(peer!.canDownload).toBe(false);
      await act(async () => {
        stalePeerAction();
        await until(mutationsSettled);
      });
      expect(device.downloads).toBe(1);
    }
    await act(async () => peerRenderer?.unmount());
    await act(async () => {
      device.presence = "downloaded";
      addLocalProject();
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
    expect(device.downloads).toBe(1 + Number(shouldRetry) + Number(hasRetryableFailure));
  } finally {
    release.resolve();
    releaseRemoval.resolve();
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
