import { expect, test } from "bun:test";
import { defineCommand, defineExtension, defineView } from "@pstdio/sdk/extensions";
import { workbenchExtensionMetadataSchema } from "pstdio-api-contracts";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { checkExtensionHostCompatibility, dashboardExtensionHostCapabilities } from "../../runtime/host-capabilities";
import { normalizeExtensionSources } from "../../runtime/normalize";
import { createWorkbenchExtensionMetadata } from "./workbench-extension-metadata";

test("an independent extension declares native chat with normal private callbacks and a scoped stream command", () => {
  const watch = defineCommand({ id: "watch", title: "Watch", run: async () => undefined });
  const view = defineView({
    id: "conversation",
    title: "Conversation",
    body: {
      kind: "chat",
      draftKey: "new",
      initial: { messages: [] },
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
    initial: { messages: [] },
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
