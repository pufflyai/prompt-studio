import { expect, test } from "bun:test";
import type { AccountStatus, CloudProjectCatalogEntry, CloudProjectDeletion } from "@pstdio/sdk/client";
import { accountEvents } from "@pstdio/sdk/extensions";
import { createWorkbench, getWorkbenchOperations } from "@pstdio/workbench";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardAccountStatusQuery, getDashboardScopedQueries } from "@/lib/scoped-queries";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { publishExtensionEvent } from "@/shared/extensions/extension-webview-broadcast";
import { createProjectsModule } from "../module";
import { getCloudCopyDownloads } from "./cloud-copy-download";
import { useCloudLocalRemoval } from "./cloud-local-removal";
import { cloudProjectDeletionKey, useCloudProjectDeletions } from "./cloud-project-deletion-operations";
import { cloudCatalogKeyFor } from "./project-catalog";

const id = "team-project";
const name = "Team notes";
const managerOrigin = "https://accounts.example.test";
const user = { accountId: "personal", managerOrigin, relayOrigin: "https://relay.example.test", deviceId: "device" };
const team = { accountId: "team-a", managerOrigin };
const otherTeam = { accountId: "team-b", managerOrigin };
const teamCatalogKey = cloudCatalogKeyFor(managerOrigin, user.accountId, user.deviceId, team.accountId);
const personalCatalogKey = cloudCatalogKeyFor(managerOrigin, user.accountId, user.deviceId);
const available = {
  id,
  name,
  online: true,
  presence: "cloud-only",
  actions: { download: true, removeLocal: false, deleteCloud: true },
} satisfies CloudProjectCatalogEntry;
const deletion: CloudProjectDeletion = {
  projectId: id,
  state: "completed",
  operationId: "team-deletion",
  startedAt: "2026-11-24T12:00:00.000Z",
  completedAt: "2026-11-24T12:00:01.000Z",
};

const setup = async (loseWrite = false) => {
  let status: AccountStatus = {
    login: user,
    features: { relay: true },
    cloudProjects: ["personal-project"],
    cloudProjectsLoaded: true,
    teamAccounts: [team, otherTeam].map(({ accountId }) => ({
      accountId,
      name: accountId,
      role: "owner",
      features: { relay: true },
    })),
    teamProjectOwners: { [id]: team.accountId },
    teamProjects: { [id]: team.accountId },
  };
  const calls: { action: string; query?: Record<string, string>; body?: unknown }[] = [];
  const readbackStarted = Promise.withResolvers<void>();
  const releaseReadback = Promise.withResolvers<void>();
  let pauseReadback = false;
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/v1/account") return Response.json(status);
      if (request.method === "GET" && url.pathname === "/v1/account/projects") {
        calls.push({ action: "catalog", query: Object.fromEntries(url.searchParams) });
        readbackStarted.resolve();
        if (pauseReadback) await releaseReadback.promise;
        return Response.json({
          account: team,
          projects: [{ ...available, presence: "downloaded", actions: { ...available.actions, download: false } }],
          deletions: [],
        });
      }
      if (request.method !== "POST") return Response.json({ error: "Unexpected request" }, { status: 404 });
      if (loseWrite) return Response.json({ error: "Response lost" }, { status: 503 });
      const action = url.pathname.split("/").at(-1)!;
      if (action === "download") {
        calls.push({ action, query: Object.fromEntries(url.searchParams) });
        return Response.json({ projectId: id, presence: "downloading" });
      }
      const body: unknown = await request.json();
      calls.push({ action, body });
      if (action === "remove-local") return Response.json({ projectId: id, presence: "cloud-only" });
      if (action === "delete-cloud") return Response.json(deletion);
      return Response.json({ error: "Unexpected request" }, { status: 404 });
    },
  });
  const runtime = globalThis as typeof globalThis & {
    __PSTDIO_CONFIG__?: { apiBaseUrl: string };
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };
  const previousConfig = runtime.__PSTDIO_CONFIG__;
  const previousAct = runtime.IS_REACT_ACT_ENVIRONMENT;
  runtime.__PSTDIO_CONFIG__ = { apiBaseUrl: server.url.origin };
  runtime.IS_REACT_ACT_ENVIRONMENT = true;
  const owner = getRuntimeCollections();
  const statusQuery = getDashboardAccountStatusQuery(owner);
  const client = getDashboardQueryClient(owner);
  const downloads = getCloudCopyDownloads(owner);
  let removals: ReturnType<typeof useCloudLocalRemoval>;
  let deletions: ReturnType<typeof useCloudProjectDeletions>;
  const Probe = () => {
    removals = useCloudLocalRemoval();
    deletions = useCloudProjectDeletions();
    return null;
  };
  let renderer: ReactTestRenderer | undefined;
  const dispose = async () => {
    releaseReadback.resolve();
    await act(async () => renderer?.unmount());
    await owner.dispose();
    runtime.__PSTDIO_CONFIG__ = previousConfig;
    runtime.IS_REACT_ACT_ENVIRONMENT = previousAct;
    server.stop(true);
  };
  try {
    await statusQuery.read();
    client.setQueryData(teamCatalogKey, { account: team, projects: [available], deletions: [] });
    await act(async () => {
      renderer = create(<Probe />);
    });
    return {
      calls,
      client,
      receipts: getWorkbenchOperations(getDashboardScopedQueries(owner)),
      download: (account = team) => downloads.start(id, account, user, available, () => {}),
      removals: removals!,
      deletions: deletions!,
      dispose,
      readbackStarted: readbackStarted.promise,
      releaseReadback: () => releaseReadback.resolve(),
      pauseReadback: () => {
        pauseReadback = true;
      },
      async changeStatus(update: (current: AccountStatus) => AccountStatus) {
        status = update(status);
        publishExtensionEvent({ id: accountEvents.changed.id }, owner);
        await statusQuery.read();
      },
    };
  } catch (error) {
    await dispose();
    throw error;
  }
};

test("team copy actions send the project owner and keep personal catalog and receipts separate", async () => {
  const host = await setup();
  const personal = { account: user, projects: [{ id: "personal-project" }], deletions: [] };
  host.client.setQueryData(personalCatalogKey, personal);
  try {
    await act(async () => {
      await expect(host.download()).resolves.toMatchObject({ presence: "downloading" });
      expect(host.client.getQueryData(teamCatalogKey)).toMatchObject({
        account: team,
        projects: [{ id, presence: "downloaded" }],
      });
      await expect(host.removals.remove(id, name, team, user, false)).resolves.toMatchObject({
        presence: "cloud-only",
      });
      await expect(host.deletions.start(id, name, team, user)).resolves.toEqual(deletion);
    });
    const { accountId, deviceId } = user;
    const deviceQuery = { deviceAccountId: accountId, deviceManagerOrigin: managerOrigin, deviceId };
    const expectedDevice = { accountId, managerOrigin, deviceId };
    expect(host.calls).toEqual([
      { action: "download", query: { accountId: team.accountId, managerOrigin, ...deviceQuery } },
      { action: "catalog", query: { accountId: team.accountId, ...deviceQuery } },
      { action: "remove-local", body: { discardUnsynced: false, expectedAccount: team, expectedDevice } },
      { action: "delete-cloud", body: { confirm: true, expectedAccount: team, expectedDevice } },
    ]);
    expect(host.client.getQueryData(teamCatalogKey)).toMatchObject({
      account: team,
      projects: [{ id, presence: "cloud-only", actions: { download: false } }],
    });
    expect(host.client.getQueryData(personalCatalogKey)).toEqual(personal);
    expect(host.client.getQueryData(cloudProjectDeletionKey(id, team, user))).toEqual(deletion);
    expect(host.client.getQueryData(cloudProjectDeletionKey(id, user, user))).toBeUndefined();
    const differentUser = { ...user, accountId: "other-personal" };
    expect(host.client.getQueryData(cloudProjectDeletionKey(id, team, differentUser))).toBeUndefined();
  } finally {
    await host.dispose();
  }
});

test("copy actions reject a personal or different team owner and an unavailable team selection", async () => {
  const host = await setup();
  try {
    const expectRefused = async (account: typeof team) => {
      await expect(host.download(account)).rejects.toThrow("active Cloud account changed");
      await expect(host.removals.remove(id, name, account, user, false)).rejects.toThrow(
        "active Cloud account changed",
      );
      await expect(host.deletions.start(id, name, account, user)).rejects.toThrow("active Cloud account changed");
    };
    await expectRefused(user);
    await expectRefused(otherTeam);
    await act(async () =>
      host.changeStatus((status) => ({
        ...status,
        teamAccounts: status.teamAccounts?.filter(({ accountId }) => accountId !== team.accountId),
        teamProjects: {},
      })),
    );
    await expectRefused(team);
    expect(host.calls).toEqual([]);
  } finally {
    await host.dispose();
  }
});

test.each([
  "manager",
  "account",
  "team",
] as const)("pending team download cannot publish after %s changes", async (change) => {
  const host = await setup();
  try {
    host.pauseReadback();
    await act(async () => {
      const result = host.download().catch((error: unknown) => error);
      await host.readbackStarted;
      await host.changeStatus((status) => {
        if (change === "manager") return { ...status, login: { ...user, managerOrigin: "https://other.example.test" } };
        if (change === "account") return { ...status, login: { ...user, accountId: "other-personal" } };
        return { ...status, teamAccounts: [], teamProjects: {} };
      });
      host.releaseReadback();
      expect(await result).toBeInstanceOf(Error);
    });
    expect(host.client.getQueryData(teamCatalogKey)).toMatchObject({ account: team, projects: [available] });
    expect(host.client.getQueryData(personalCatalogKey)).toBeUndefined();
  } finally {
    await host.dispose();
  }
});

test.each([
  "download",
  "remove",
  "delete",
] as const)("%s recovery returns to the owning team's required picker", async (action) => {
  const host = await setup(true);
  const workbench = createWorkbench();
  try {
    await act(async () => {
      const operations = {
        download: () => host.download(),
        remove: () => host.removals.remove(id, name, team, user, false),
        delete: () => host.deletions.start(id, name, team, user),
      };
      await expect(operations[action]()).rejects.toThrow("Response lost");
    });
    workbench.registerModule(createProjectsModule());
    const source = host.receipts.getSnapshot().recovery[0]?.sourceCommand;
    expect(source).toBeDefined();
    await workbench.commands.executeCommand(source!.id, source!.args);
    expect(workbench.modes.getActiveModeId()).toBe("project-selection");
    expect(
      workbench.layout.listPanelInstances("overlay").find(({ viewId }) => viewId === dashboardWidgetIds.projectPicker),
    ).toMatchObject({ closable: false, pageContext: { params: { teamAccountId: team.accountId } } });

    workbench.modes.setActiveMode(undefined);
    selectDashboardProject(workbench, { id: "local-project", name: "Local notes" });
    await workbench.commands.executeCommand(source!.id, source!.args);
    const active = () => workbench.layout.getActivePanel("overlay");
    expect(active()).toMatchObject({ closable: true, pageContext: { params: { teamAccountId: team.accountId } } });
    await workbench.commands.executeCommand(dashboardCommandIds.openProjects);
    expect(active()?.pageContext?.params?.teamAccountId).toBeUndefined();
  } finally {
    await workbench.dispose();
    await host.dispose();
  }
});
