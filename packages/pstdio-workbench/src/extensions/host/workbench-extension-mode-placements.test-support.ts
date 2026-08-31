import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { createWorkbenchCore } from "../../core";
import { getWorkbenchPageRegistryInternals } from "../../core/registries/pages/page-registry-internals";
import { emptyWorkbenchExtensionMetadata } from "../contributions/extension-contributions";

export const extensionId = "pstdio.hostile";
export const modeId = `${extensionId}.mode.project`;
export const pageId = `${extensionId}.page.ticket`;
export const listPageId = `${extensionId}.page.tickets`;

const webview = (path: string) => ({
  entry: { kind: "package-asset" as const, path, baseUrl: "file:///extensions/hostile/" },
  runtimeUrl: "/runtime.html",
  moduleUrl: `/${path}.js`,
});

export const metadata = {
  ...emptyWorkbenchExtensionMetadata,
  extensions: [{ id: extensionId, name: "hostile", displayName: "Hostile", sourcePath: "/extensions/hostile" }],
  modes: [{ id: modeId, localId: "project", extensionId, label: "Project", regions: ["main", "side"] }],
  pages: [
    {
      id: listPageId,
      localId: "tickets",
      extensionId,
      title: "Tickets",
      path: "tickets",
      mode: { extensionId, kind: "mode", id: "project" },
      slots: [
        {
          id: "content",
          role: "primary",
          region: "main",
          view: { extensionId, kind: "view", id: "tickets" },
        },
      ],
    },
    {
      id: pageId,
      localId: "ticket",
      extensionId,
      title: "Ticket",
      path: "ticket",
      mode: { extensionId, kind: "mode", id: "project" },
      slots: [
        {
          id: "content",
          role: "primary",
          region: "main",
          view: { extensionId, kind: "view", id: "ticket" },
        },
        {
          id: "emoji",
          role: "auxiliary",
          region: "side",
          view: { extensionId, kind: "view", id: "emoji" },
          defaultOpen: true,
          order: 10,
        },
      ],
    },
  ],
  views: [
    {
      id: `${extensionId}.view.tickets`,
      localId: "tickets",
      extensionId,
      title: "Tickets",
      body: { kind: "webview", webview: webview("tickets.tsx") },
    },
    {
      id: `${extensionId}.view.ticket`,
      localId: "ticket",
      extensionId,
      title: "Ticket",
      body: { kind: "webview", webview: webview("ticket.tsx") },
    },
    {
      id: `${extensionId}.view.sessions`,
      localId: "sessions",
      extensionId,
      title: "Sessions",
      body: { kind: "webview", webview: webview("sessions.tsx") },
    },
    {
      id: `${extensionId}.view.emoji`,
      localId: "emoji",
      extensionId,
      title: "Emoji",
      body: { kind: "webview", webview: webview("emoji.tsx") },
    },
    {
      id: `${extensionId}.view.inspector`,
      localId: "inspector",
      extensionId,
      title: "Inspector",
      body: { kind: "webview", webview: webview("inspector.tsx") },
    },
  ],
  placements: [
    {
      id: `${extensionId}.placement.sessions`,
      localId: "sessions",
      extensionId,
      mode: { extensionId, kind: "mode", id: "project" },
      item: { kind: "view", view: { extensionId, kind: "view", id: "sessions" } },
      region: "side",
      order: 0,
    },
    {
      id: `${extensionId}.placement.inspector`,
      localId: "inspector",
      extensionId,
      mode: { extensionId, kind: "mode", id: "project" },
      item: {
        kind: "resource-slot",
        slot: { resourceKind: { extensionId, kind: "resource-kind", id: "artifact" }, id: "inspector" },
      },
      region: "side",
      order: 20,
    },
  ],
  resourceKinds: [
    {
      id: `${extensionId}.resource-kind.artifact`,
      localId: "artifact",
      extensionId,
      surface: "attached",
      label: "Artifact",
      slots: [{ id: "inspector", cardinality: "many", access: "owner" }],
    },
  ],
  resourceViews: [
    {
      id: `${extensionId}.resource-view.inspector`,
      extensionId,
      resourceKind: { extensionId, kind: "resource-kind", id: "artifact" },
      slot: { resourceKind: { extensionId, kind: "resource-kind", id: "artifact" }, id: "inspector" },
      view: { extensionId, kind: "view", id: "inspector" },
    },
  ],
} satisfies WorkbenchExtensionMetadata;

export const activate = (workbench: ReturnType<typeof createWorkbenchCore>, id: string, projectId = "project-1") =>
  getWorkbenchPageRegistryInternals(workbench.pages).activateLocation({
    pageId: id,
    projectId,
    location: {
      page: { extensionId, kind: "page", id: id === pageId ? "ticket" : "tickets" },
    },
    action: "testActivatePage",
  });
