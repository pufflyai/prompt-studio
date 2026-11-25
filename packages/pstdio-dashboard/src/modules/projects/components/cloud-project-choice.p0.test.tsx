import { expect, test } from "bun:test";
import { accountEvents } from "@pstdio/sdk/extensions";
import { getWorkbenchOperations } from "@pstdio/workbench";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardAccountStatusQuery, getDashboardScopedQueries } from "@/lib/scoped-queries";
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
  let failReplacement = changed === "deviceId";
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const readingReplacement = Promise.withResolvers<void>();
  const releaseReplacement = Promise.withResolvers<void>();
  const requestedAccounts: unknown[] = [];
  let opened = 0;
  let closed = 0;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      const { deviceId, ...account } = active;
      if (url.pathname === "/v1/account") {
        if (active === replacement && failReplacement) {
          readingReplacement.resolve();
          await releaseReplacement.promise;
          return Response.json({ error: "Could not verify the current device" }, { status: 503 });
        }
        return Response.json({
          login: { ...account, deviceId },
          features: { relay: true },
          cloudProjects: [id],
          cloudProjectsLoaded: true,
          signInRequired: false,
        });
      }
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
      <button data-presence={choice.entry?.presence} disabled={!choice.canDownload} onClick={choice.requestDownload}>
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
      if (changed === "deviceId") {
        await readingReplacement.promise;
        const key = cloudCatalogKeyFor(original.managerOrigin, original.accountId, original.deviceId);
        await client.refetchQueries({ queryKey: key, exact: true }, { cancelRefetch: false });
      }
    });
    if (changed === "deviceId") {
      await act(async () => until(() => renderer!.root.findByType("button").props["data-presence"] === "downloaded"));
      expect({ opened, closed }).toEqual({ opened: 0, closed: 0 });
      await act(async () => {
        releaseReplacement.resolve();
        await until(() => Boolean(status.getSnapshot().error) && !status.getSnapshot().fetching);
      });
      expect(status.getSnapshot().data?.login?.deviceId).toBe(original.deviceId);
      expect({ opened, closed }).toEqual({ opened: 0, closed: 0 });
    }
    await act(async () => {
      if (changed === "deviceId") {
        failReplacement = false;
        publishExtensionEvent({ id: accountEvents.changed.id }, owner);
      }
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
    releaseReplacement.resolve();
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
  "removal after retry",
  "rejected removal after retry",
] as const;

const copyDevice = (outcome: (typeof copyStates)[number], retry: boolean) => {
  const id = "recovered-project";
  const account = { managerOrigin: "https://accounts.example.test", accountId: "account-a" };
  const folderError = "Could not prepare the project folder";
  const rejectedRemoval = outcome === "rejected removal after retry";
  const removingCopy = outcome === "removal receipt" || outcome.endsWith("after retry");
  const device: {
    presence: string;
    id: string;
    downloadError?: string;
    lostReply?: "before-write" | "after-write";
    syncFailed: boolean;
    downloads: number;
    holdCatalog?: boolean;
    catalogUnavailable?: boolean;
    downloadUnavailable?: boolean;
    removalReplyLost?: boolean;
  } = {
    presence: removingCopy || retry ? "downloading" : "cloud-only",
    id: "device",
    downloadError: retry && outcome === "folder error" ? folderError : undefined,
    syncFailed: removingCopy || (retry && outcome === "sync error"),
    downloads: 0,
  };
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const removalStarted = Promise.withResolvers<void>();
  const releaseRemoval = Promise.withResolvers<void>();
  const catalogCaptured = Promise.withResolvers<void>();
  const releaseCatalog = Promise.withResolvers<void>();
  const download = async () => {
    const lostReply = device.lostReply;
    device.lostReply = undefined;
    const failed = () => Response.json({ error: "Download response lost" }, { status: 503 });
    device.downloads++;
    started.resolve();
    await release.promise;
    if (lostReply === "before-write") return failed();
    if (retry || device.downloads > 1 || outcome.endsWith("after retry")) {
      device.presence = "downloading";
      device.downloadError = undefined;
      device.syncFailed = false;
      return lostReply === "after-write" ? failed() : Response.json({ projectId: id, presence: device.presence });
    }
    device.presence = outcome === "folder error" || outcome === "sync error" ? "downloading" : outcome;
    if (outcome === "folder error") device.downloadError = folderError;
    if (outcome === "sync error") device.syncFailed = true;
    return failed();
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
    if (rejectedRemoval) return Response.json({ error: "Removal rejected before touching the copy" }, { status: 400 });
    device.presence = "cloud-only";
    if (device.removalReplyLost) return Response.json({ error: "Removal response lost" }, { status: 503 });
    return Response.json({ projectId: id, presence: "cloud-only" });
  };
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/v1/account")
        return Response.json({
          login: { ...account, deviceId: device.id },
          features: { relay: true },
          cloudProjects: [id],
          cloudProjectsLoaded: true,
          signInRequired: false,
        });
      if (url.pathname.endsWith("/download")) return download();
      if (url.pathname.endsWith("/delete-cloud")) return deleteCloud();
      if (url.pathname.endsWith("/remove-local")) return removeLocal();
      if (url.pathname === "/v1/account/projects") {
        if (device.catalogUnavailable)
          return Response.json({ error: "Cloud project catalog is unavailable" }, { status: 503 });
        const observation = Response.json({
          account,
          membershipKnown: true,
          deletions: [],
          projects: [
            {
              id,
              name: "Recovered notes",
              online: !device.downloadUnavailable,
              presence: device.presence,
              downloadError: device.downloadError,
              actions: {
                download: device.presence !== "downloaded" && !device.downloadUnavailable,
                removeLocal: removingCopy,
                deleteCloud: false,
              },
            },
          ],
        });
        if (device.holdCatalog) {
          device.holdCatalog = false;
          catalogCaptured.resolve();
          return releaseCatalog.promise.then(() => observation);
        }
        return observation;
      }
      return Response.json({
        state: device.syncFailed ? "needs-attention" : "first-download-incomplete",
        offlineReady: false,
      });
    },
  });
  return {
    id,
    account,
    device,
    folderError,
    server,
    started,
    release,
    removalStarted,
    releaseRemoval,
    catalogCaptured,
    releaseCatalog,
  };
};

const mountCopyChoices = async (outcome: (typeof copyStates)[number], retry = false) => {
  const fixture = copyDevice(outcome, retry);
  const { id, server, release, releaseRemoval, releaseCatalog } = fixture;
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
  const clickAndSettle = (action: () => void) =>
    act(async () => {
      action();
      await until(mutationsSettled);
    });
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
  const cleanup = async () => {
    release.resolve();
    releaseRemoval.resolve();
    releaseCatalog.resolve();
    await act(async () => {
      renderer?.unmount();
      peerRenderer?.unmount();
    });
    client.clear();
    await owner.dispose();
    runtime.__PSTDIO_CONFIG__ = previous;
    runtime.IS_REACT_ACT_ENVIRONMENT = previousAct;
    await server.stop(true);
  };
  try {
    if (retry || outcome === "removal receipt" || outcome.endsWith("after retry")) addLocalProject();
    await getDashboardAccountStatusQuery(owner).read();
    await act(async () => {
      renderer = create(
        <QueryClientProvider client={client}>
          <StrictMode>
            <Probe />
          </StrictMode>
        </QueryClientProvider>,
      );
      peerRenderer = create(
        <QueryClientProvider client={client}>
          <StrictMode>
            <Probe other />
          </StrictMode>
        </QueryClientProvider>,
      );
    });
    await act(async () => until(() => choice?.canDownload && peer?.canDownload));
    return {
      ...fixture,
      owner,
      client,
      opened,
      addLocalProject,
      mutationsSettled,
      clickAndSettle,
      cleanup,
      unmountPeer: () => act(async () => peerRenderer?.unmount()),
      remountPeer: () =>
        act(async () => {
          peerRenderer?.update(
            <QueryClientProvider client={client}>
              <StrictMode>
                <Probe key={fixture.device.id} other />
              </StrictMode>
            </QueryClientProvider>,
          );
        }),
      get closed() {
        return closed;
      },
      get choice() {
        return choice!;
      },
      get peer() {
        return peer!;
      },
      get deletions() {
        return deletions!;
      },
      get removal() {
        return removal!;
      },
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
};

test.each(copyStates)("two views check the current device state before downloading (%s)", async (outcome) => {
  const fixture = await mountCopyChoices(outcome);
  const {
    id,
    account,
    device,
    folderError,
    started,
    release,
    removalStarted,
    releaseRemoval,
    catalogCaptured,
    releaseCatalog,
    opened,
    owner,
    client,
    addLocalProject,
    mutationsSettled,
    clickAndSettle,
  } = fixture;
  try {
    const stalePeerAction = fixture.peer.requestDownload;
    expect(opened).toEqual([]);
    if (outcome.endsWith("after retry")) {
      await act(async () => {
        release.resolve();
        fixture.choice.requestDownload();
        await until(() => device.downloads === 1 && mutationsSettled());
      });
      expect(fixture.choice.entry?.presence).toBe("downloading");
      expect(fixture.choice.failure).toBeUndefined();
      let inFlightCatalog: Promise<void>;
      await act(async () => {
        device.presence = "downloaded";
        device.holdCatalog = true;
        inFlightCatalog = client.refetchQueries({ queryKey: ["cloud-project-catalog"] });
        await catalogCaptured.promise;
      });
      let result: Promise<unknown>;
      await act(async () => {
        result = fixture.removal.remove(id, "Recovered notes", account, false);
        await removalStarted.promise;
      });
      await act(async () => {
        releaseCatalog.resolve();
        await inFlightCatalog!;
        await until(() => fixture.choice.entry?.presence === "downloaded");
      });
      const beforeReceipt = { claimed: fixture.removal.active(id), opened: opened.length, closed: fixture.closed };
      if (outcome === "rejected removal after retry") {
        await act(async () => {
          releaseRemoval.resolve();
          await expect(result!).rejects.toThrow("Removal rejected before touching the copy");
        });
        expect(fixture.removal.active(id)).toBe(false);
        expect({ beforeReceipt, downloads: device.downloads, opened: opened.length, closed: fixture.closed }).toEqual({
          beforeReceipt: { claimed: true, opened: 0, closed: 0 },
          downloads: 1,
          opened: 1,
          closed: 1,
        });
        return;
      }
      await act(async () => {
        device.presence = "cloud-only";
        device.catalogUnavailable = true;
        // Sync can retire the local row before the HTTP removal receipt arrives.
        owner.getWriter("projects")!.remove(id);
        releaseRemoval.resolve();
        await result!;
        await until(
          () =>
            fixture.choice.entry?.presence === "cloud-only" &&
            fixture.choice.failure === "Cloud project catalog is unavailable",
        );
      });
      expect(fixture.peer.canDownload).toBe(false);
      await act(async () => {
        device.catalogUnavailable = false;
        device.downloadUnavailable = true;
        await until(() => fixture.peer.entry?.online === false);
      });
      expect(fixture.peer.canDownload).toBe(false);
      await act(async () => {
        device.downloadUnavailable = false;
        publishExtensionEvent({ id: accountEvents.changed.id }, owner);
        await until(() => fixture.peer.canDownload);
      });
      const afterRemoval = { canDownload: fixture.choice.canDownload, showProgress: fixture.choice.showProgress };
      await act(async () => {
        fixture.peer.requestDownload();
        await until(() => device.downloads === 2 && mutationsSettled());
      });
      await act(async () => {
        device.presence = "downloaded";
        addLocalProject();
        publishExtensionEvent({ id: accountEvents.changed.id }, owner);
        await until(
          () =>
            fixture.choice.entry?.presence === "downloaded" &&
            fixture.peer.entry?.presence === "downloaded" &&
            opened.length === 1 &&
            fixture.closed === 1,
        );
      });
      expect({ beforeReceipt, afterRemoval, opened: opened.length, closed: fixture.closed }).toEqual({
        beforeReceipt: { claimed: true, opened: 0, closed: 0 },
        afterRemoval: { canDownload: true, showProgress: false },
        opened: 1,
        closed: 1,
      });
      return;
    }
    if (outcome === "deletion receipt" || outcome === "removal receipt") {
      release.resolve();
      let result: Promise<unknown>;
      await act(async () => {
        result =
          outcome === "deletion receipt"
            ? fixture.deletions.start(id, "Recovered notes", account)
            : fixture.removal.remove(id, "Recovered notes", account, false);
        await removalStarted.promise;
      });
      await clickAndSettle(stalePeerAction);
      expect(device.downloads).toBe(0);
      await act(async () => {
        if (outcome === "removal receipt") owner.getWriter("projects")!.remove(id);
        releaseRemoval.resolve();
        await result!;
      });
      expect(fixture.removal.active(id)).toBe(false);
      await clickAndSettle(stalePeerAction);
      expect(device.downloads).toBe(0);
      expect(fixture.peer.entry?.presence).toBe("cloud-only");
      return;
    }
    await act(async () => {
      fixture.choice.requestDownload();
      await started.promise;
    });
    expect(fixture.peer.showProgress).toBe(true);
    expect(fixture.peer.canDownload).toBe(false);
    await act(async () => {
      fixture.peer.requestDownload();
      release.resolve();
    });
    const hasRetryableFailure = outcome === "folder error" || outcome === "sync error";
    const shouldRetry = hasRetryableFailure || outcome === "cloud-only";
    if (outcome === "sync error") {
      await act(async () => addLocalProject());
    }
    if (outcome === "cloud-only") {
      await act(async () => until(() => Boolean(fixture.choice.discardDownload)));
      await act(async () => fixture.choice.discardDownload?.());
    }
    // A retired recovery claim must not make an already-admitted copy eligible again.
    await act(async () =>
      until(
        () =>
          fixture.peer.entry?.presence === device.presence &&
          !fixture.choice.downloadBlocking &&
          !fixture.peer.downloadBlocking,
      ),
    );
    expect(device.downloads).toBe(1);
    if (shouldRetry) {
      await act(async () => until(() => fixture.choice.canDownload && fixture.peer.canDownload));
      const staleRetry = fixture.peer.requestDownload;
      expect(fixture.peer.canDownload).toBe(true);
      await act(async () => {
        fixture.choice.requestDownload();
        await until(() => device.downloads === 2 && mutationsSettled());
      });
      if (hasRetryableFailure) {
        await clickAndSettle(staleRetry);
        expect(device.downloads).toBe(2);
        if (outcome === "folder error") device.downloadError = folderError;
        else device.syncFailed = true;
        await act(async () => {
          await client.refetchQueries({
            queryKey: [outcome === "folder error" ? "cloud-project-catalog" : "cloud-project-opening"],
          });
          await until(() => fixture.choice.canDownload && fixture.peer.canDownload);
        });
        await clickAndSettle(staleRetry);
        expect(device.downloads).toBe(2);
        await act(async () => {
          fixture.choice.requestDownload();
          await until(() => device.downloads === 3 && mutationsSettled());
        });
      }
    } else {
      expect(fixture.peer.canDownload).toBe(false);
      await clickAndSettle(stalePeerAction);
      expect(device.downloads).toBe(1);
    }
    await fixture.unmountPeer();
    await act(async () => {
      device.presence = "downloaded";
      addLocalProject();
      publishExtensionEvent({ id: accountEvents.changed.id }, owner);
      await until(() => fixture.choice.entry?.presence === "downloaded" && opened.length > 0);
    });
    expect(opened).toEqual([
      {
        command: dashboardCommandIds.selectProject,
        args: { project: { id, name: "Recovered notes" } },
      },
    ]);
    expect(fixture.closed).toBe(1);
    expect(device.downloads).toBe(1 + Number(shouldRetry) + Number(hasRetryableFailure));
  } finally {
    await fixture.cleanup();
  }
});

test.each([
  "accountId",
  "managerOrigin",
] as const)("local removal cannot reconcile after the %s changes", async (changed) => {
  const fixture = await mountCopyChoices("removal receipt");
  const { id, account, owner, client, removalStarted, releaseRemoval } = fixture;
  let result: Promise<unknown> | undefined;
  try {
    await act(async () => {
      result = fixture.removal.remove(id, "Recovered notes", { ...account }, false);
      // Observe retirement immediately, before allowing the old response to arrive.
      void result.catch(() => {});
      await removalStarted.promise;
    });
    await act(async () => {
      account[changed] = changed === "accountId" ? "replacement-account" : "https://replacement.example.test";
      publishExtensionEvent({ id: accountEvents.changed.id }, owner);
      await until(
        () => getDashboardAccountStatusQuery(owner).getSnapshot().data?.login?.[changed] === account[changed],
      );
    });
    await expect(result!).rejects.toThrow("original authority is no longer active");
    const key = cloudCatalogKeyFor(account.managerOrigin, account.accountId, fixture.device.id);
    await act(async () => until(() => Boolean(client.getQueryData(key))));
    const replacementCatalog = client.getQueryData(key);
    await act(async () => releaseRemoval.resolve());
    expect(client.getQueryData(key)).toBe(replacementCatalog);
    expect(fixture.opened).toEqual([]);
  } finally {
    releaseRemoval.resolve();
    await result?.catch(() => {});
    await fixture.cleanup();
  }
});

test("discarding a lost removal draft keeps its copy claim against Cloud deletion", async () => {
  const fixture = await mountCopyChoices("removal receipt");
  const { id, account, device, owner, removalStarted, releaseRemoval } = fixture;
  const operations = getWorkbenchOperations(getDashboardScopedQueries(owner));
  let result: Promise<unknown> | undefined;
  try {
    device.removalReplyLost = true;
    await act(async () => {
      result = fixture.removal.remove(id, "Recovered notes", account, false);
      void result.catch(() => {});
      await removalStarted.promise;
      releaseRemoval.resolve();
      const error = await result.then(
        () => undefined,
        (error) => error,
      );
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("Removal response lost");
    });
    const recovery = operations.getSnapshot().recovery.find((entry) => entry.domain === "project.remove-device-copy");
    expect(recovery?.status).toBe("unknown");
    await act(async () => {
      operations.discard(recovery!.id);
      device.id = "replacement-device";
      publishExtensionEvent({ id: accountEvents.changed.id }, owner);
      await until(() => getDashboardAccountStatusQuery(owner).getSnapshot().data?.login?.deviceId === device.id);
    });
    expect(fixture.removal.active(id)).toBe(false);
    const error = await fixture.deletions.start(id, "Recovered notes", account).then(
      () => undefined,
      (error) => error,
    );
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("pending Cloud change");
  } finally {
    releaseRemoval.resolve();
    await result?.catch(() => {});
    await fixture.cleanup();
  }
});

test("local removal on another device still blocks account-wide Cloud deletion", async () => {
  const fixture = await mountCopyChoices("removal receipt");
  const { id, account, device, owner, client, removalStarted, releaseRemoval } = fixture;
  let result: Promise<unknown> | undefined;
  try {
    await act(async () => {
      result = fixture.removal.remove(id, "Recovered notes", account, false);
      await removalStarted.promise;
    });
    await act(async () => {
      device.id = "replacement-device";
      device.presence = "downloaded";
      publishExtensionEvent({ id: accountEvents.changed.id }, owner);
      await until(() => getDashboardAccountStatusQuery(owner).getSnapshot().data?.login?.deviceId === device.id);
      await until(() => fixture.peer.entry?.presence === "downloaded");
    });
    expect(fixture.removal.active(id)).toBe(false);
    await expect(fixture.deletions.start(id, "Recovered notes", account)).rejects.toThrow("pending Cloud change");
    const key = cloudCatalogKeyFor(account.managerOrigin, account.accountId, device.id);
    const replacementCatalog = client.getQueryData(key);
    await act(async () => {
      releaseRemoval.resolve();
      await result;
    });
    expect(client.getQueryData(key)).toBe(replacementCatalog);
    expect(fixture.opened).toEqual([]);
  } finally {
    releaseRemoval.resolve();
    await result?.catch(() => {});
    await fixture.cleanup();
  }
});

test.each([
  "folder error",
  "sync error",
] as const)("a lost Retry with the same %s stays unresolved", async (outcome) => {
  const fixture = await mountCopyChoices(outcome, true);
  const { device, release } = fixture;
  try {
    const initialFailure = fixture.choice.failure;
    expect(initialFailure).toBeDefined();
    release.resolve();
    device.lostReply = "before-write";
    await fixture.clickAndSettle(fixture.choice.requestDownload);
    await act(async () => {
      await until(() => !fixture.choice.downloadBlocking || Boolean(fixture.choice.checkDownload));
      await fixture.choice.checkDownload?.();
    });
    expect({
      blocking: fixture.choice.downloadBlocking,
      failure: fixture.choice.failure,
      progress: fixture.choice.showProgress,
    }).toEqual({ blocking: true, failure: initialFailure, progress: false });
    expect(fixture.peer.canDownload).toBe(false);
    expect(fixture.choice.discardDownload).toBeDefined();
    await act(async () => fixture.choice.discardDownload?.());
    await act(async () => until(() => fixture.peer.canDownload));
    await fixture.clickAndSettle(fixture.peer.requestDownload);
    expect([device.downloads, fixture.peer.downloadBlocking]).toEqual([2, false]);
  } finally {
    await fixture.cleanup();
  }
});

test.each([
  "folder error",
  "sync error",
] as const)("a lost Retry with progress from %s confirms the copy", async (outcome) => {
  const fixture = await mountCopyChoices(outcome, true);
  try {
    fixture.release.resolve();
    fixture.device.lostReply = "after-write";
    await fixture.clickAndSettle(fixture.choice.requestDownload);
    await act(async () => until(() => !fixture.choice.downloadBlocking));
    expect({ attempts: fixture.device.downloads, progress: fixture.choice.showProgress }).toEqual({
      attempts: 1,
      progress: true,
    });
  } finally {
    await fixture.cleanup();
  }
});

test("a lost download from another device does not block a new device on the same account", async () => {
  const fixture = await mountCopyChoices("cloud-only");
  const { device, release, owner } = fixture;
  try {
    release.resolve();
    device.lostReply = "before-write";
    await fixture.clickAndSettle(fixture.choice.requestDownload);
    await act(async () => until(() => Boolean(fixture.choice.checkDownload)));
    const staleCheck = fixture.choice.checkDownload;
    await act(async () => {
      device.id = "new-device";
      publishExtensionEvent({ id: accountEvents.changed.id }, owner);
      await until(() => getDashboardAccountStatusQuery(owner).getSnapshot().data?.login?.deviceId === device.id);
    });
    await fixture.remountPeer();
    await act(async () => until(() => fixture.peer.entry?.presence === "cloud-only"));
    expect({ canDownload: fixture.peer.canDownload, blocking: fixture.peer.downloadBlocking }).toEqual({
      canDownload: true,
      blocking: false,
    });
    await act(async () => staleCheck?.());
    await expect(fixture.deletions.start(fixture.id, "Recovered notes", fixture.account)).rejects.toThrow(
      "This project already has a pending Cloud change.",
    );
    await fixture.clickAndSettle(fixture.peer.requestDownload);
    expect([device.downloads, fixture.peer.downloadBlocking]).toEqual([2, false]);
  } finally {
    await fixture.cleanup();
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
