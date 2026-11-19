import { expect, test } from "bun:test";
import { accountEvents } from "@pstdio/sdk/extensions";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardAccountStatusQuery } from "@/lib/scoped-queries";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { publishExtensionEvent } from "@/shared/extensions/extension-webview-broadcast";
import { useCloudProjectChoice } from "./use-cloud-project-choice";

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
