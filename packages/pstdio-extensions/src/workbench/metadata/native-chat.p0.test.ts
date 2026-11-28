import { expect, test } from "bun:test";
import { defineCommand, defineExtension, defineView } from "@pstdio/sdk/extensions";
import { workbenchExtensionMetadataSchema } from "pstdio-api-contracts";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { checkExtensionHostCompatibility, dashboardExtensionHostCapabilities } from "../../runtime/host-capabilities";
import { normalizeExtensionSources } from "../../runtime/normalize";
import { viewDeclarationSchema } from "../../runtime/normalize/view-declaration";
import { createWorkbenchExtensionMetadata } from "./workbench-extension-metadata";

test("an independent extension declares native chat with normal private callbacks and a scoped stream command", () => {
  const watch = defineCommand({ id: "watch", title: "Watch", run: async () => undefined });
  const view = defineView({
    id: "conversation",
    title: "Conversation",
    body: {
      kind: "chat",
      draftKey: "new",
      initial: {
        messages: [],
        operations: [{ id: "connection", label: "Check connection", refresh: true }],
        nativeLinks: true,
        workspaceId: "workspace",
        nativeHarnessAccount: { controlId: "provider" },
        controls: [
          {
            id: "provider",
            name: "Harness",
            type: "harness",
            defaultValue: { harnessId: "" },
            lockIdentity: true,
            preserveSettings: true,
          },
        ],
      },
      stream: watch.ref,
      query: async () => ({ messages: [] }),
      onAction: async () => undefined,
      loadDraft: async () => ({ text: "unsent", attachments: [], values: {} }),
      saveDraft: async () => undefined,
      resolveLink: async () => ({ href: null }),
      resolveImage: async () => null,
    },
  });
  const runtime = normalizeExtensionSources([
    {
      packagePath: "/fake/chat",
      sourcePath: "/fake/chat/extension.ts",
      sourceKind: "local_path",
      manifest: {
        id: "acme.chat",
        name: "chat",
        publisher: "acme",
        version: "1.0.0",
        main: "./extension.ts",
        enginesPstdio: `^${EXTENSION_API_VERSION}`,
      },
      definition: defineExtension({ views: [view], commands: [watch] }),
    },
  ]);
  expect(runtime.diagnostics).toEqual([]);
  expect(checkExtensionHostCompatibility(runtime, dashboardExtensionHostCapabilities).diagnostics).toEqual([]);
  const metadata = workbenchExtensionMetadataSchema.parse(createWorkbenchExtensionMetadata({ runtime }));
  expect(metadata.views[0]?.body).toMatchObject({
    kind: "chat",
    draftKey: "new",
    initial: {
      messages: [],
      operations: [{ id: "connection", label: "Check connection", refresh: true }],
      nativeLinks: true,
      workspaceId: "workspace",
      nativeHarnessAccount: { controlId: "provider" },
      controls: [{ id: "provider", lockIdentity: true, preserveSettings: true }],
    },
    queryHandlerId: "acme.chat.view.conversation.chat.query",
    actionHandlerId: "acme.chat.view.conversation.chat.onAction",
    loadDraftHandlerId: "acme.chat.view.conversation.chat.loadDraft",
    saveDraftHandlerId: "acme.chat.view.conversation.chat.saveDraft",
    resolveLinkHandlerId: "acme.chat.view.conversation.chat.resolveLink",
    resolveImageHandlerId: "acme.chat.view.conversation.chat.resolveImage",
    stream: { ...watch.ref, extensionId: "acme.chat" },
  });
  expect(runtime.privateHandlers.filter((handler) => handler.rendererKind === "chat")).toHaveLength(6);
});

test("browser drafts require host support, and older Sessions declarations still load", () => {
  const view = defineView({
    id: "conversation",
    title: "Conversation",
    body: {
      kind: "chat",
      draftKey: "compose",
      // Sessions releases before PS-1405 declared these; they are accepted and dropped.
      ...({ legacySessionDraft: true, browserDraft: { acknowledgeRecovery: async () => undefined } } as object),
      query: async () => ({}),
      onAction: async () => undefined,
    },
  });
  const runtime = normalizeExtensionSources([
    {
      packagePath: "/fake/chat",
      sourcePath: "/fake/chat/extension.ts",
      sourceKind: "local_path",
      manifest: {
        id: "acme.chat",
        name: "chat",
        publisher: "acme",
        version: "1.0.0",
        main: "./extension.ts",
        enginesPstdio: `^${EXTENSION_API_VERSION}`,
      },
      definition: defineExtension({ views: [view] }),
    },
  ]);
  expect(runtime.diagnostics).toEqual([]);
  const metadata = workbenchExtensionMetadataSchema.parse(
    JSON.parse(JSON.stringify(createWorkbenchExtensionMetadata({ runtime }))),
  );
  expect(metadata.views[0]?.body).toMatchObject({ browserDraft: {} });
  expect(metadata.views[0]?.body).not.toHaveProperty("legacySessionDraft");
  expect(runtime.privateHandlers.map(({ id }) => id)).not.toContain(
    "acme.chat.view.conversation.chat.acknowledgeRecovery",
  );
  expect(checkExtensionHostCompatibility(runtime, dashboardExtensionHostCapabilities).diagnostics).toEqual([]);
  const { "view.chat.browser-draft.v1": _browserDraft, ...capabilities } =
    dashboardExtensionHostCapabilities.capabilities;
  expect(
    checkExtensionHostCompatibility(runtime, { ...dashboardExtensionHostCapabilities, capabilities }).diagnostics,
  ).toContainEqual(
    expect.objectContaining({
      code: "extension_host_capability_missing",
      metadata: expect.objectContaining({ missingCapability: "view.chat.browser-draft.v1" }),
    }),
  );
});

test.each(["loadDraft", "saveDraft"])("browser persistence rejects a competing provider %s callback", (callback) => {
  const view = defineView({
    id: "conversation",
    title: "Conversation",
    body: {
      kind: "chat",
      draftKey: "compose",
      browserDraft: {},
      query: async () => ({}),
      onAction: async () => undefined,
      ...(callback === "loadDraft"
        ? { loadDraft: async () => ({ text: "", attachments: [], values: {} }) }
        : { saveDraft: async () => undefined }),
    },
  });
  const result = viewDeclarationSchema.safeParse(view);
  expect(result.success).toBe(false);
  if (!result.success) expect(result.error.message).toContain("Browser draft persistence cannot include provider");
});
