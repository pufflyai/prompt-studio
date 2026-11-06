import { expect, test } from "bun:test";
import type { ReactElement } from "react";
import { getWorkbenchRenderers, type WorkbenchPanelRenderInput } from "../../core";
import {
  createResourceViewerFixture,
  viewerPage,
  viewerResource,
} from "../../core/controllers/resource-viewers/resource-viewer-test-fixture";
import { createChatSubmissionPresentation } from "./chat-pending-submission";
import { registerWorkbenchExtensionChatRenderers } from "./chat-renderer-contributions";
import type { ChatSession } from "./chat-session";
import { emptyWorkbenchExtensionMetadata } from "./extension-contributions";

type ChatElement = ReactElement<{ session: ChatSession; conversationKey: string }>;

const confirmMessage = (session: ChatSession, revision: number, id: string) =>
  session.accept({
    revision,
    patch: {
      op: "replace",
      path: "/messages/0",
      value: {
        id,
        createdAt: 1793923200000,
        role: "user",
        parts: [{ type: "text", text: "First" }],
      },
    },
  });

for (const region of ["main", "side"] as const) {
  for (const stale of [false, true]) {
    for (const terminal of [false, true]) {
      test(`first send hands presentation to its authorized ${region} destination (stale=${stale}, terminal=${terminal})`, async () => {
        const { w, side } = createResourceViewerFixture();
        const saved: Array<{ key: unknown; draft: unknown }> = [];
        let firstAction = true;
        let complete!: (value: unknown) => void;
        const registered = registerWorkbenchExtensionChatRenderers({
          workbench: w,
          projectId: "project",
          metadata: {
            ...emptyWorkbenchExtensionMetadata,
            views: [
              {
                id: "chat",
                localId: "chat",
                extensionId: "example.readers",
                title: "Chat",
                body: {
                  kind: "chat",
                  draftKey: "compose",
                  initial: { messages: [] },
                  queryHandlerId: "chat.query",
                  actionHandlerId: "chat.action",
                  loadDraftHandlerId: "chat.load",
                  saveDraftHandlerId: "chat.save",
                },
              },
            ],
          },
          executeCommand: async (id, body) => {
            if (id === "chat.load") return { text: "", attachments: [], values: {} };
            if (id === "chat.save") {
              saved.push({ key: body.params?.draftKey, draft: body.params?.draft });
              return {};
            }
            if (id === "chat.action") {
              if (!firstAction) return {};
              firstAction = false;
              return new Promise((resolve) => {
                complete = resolve;
              });
            }
            return new Promise(() => {});
          },
        });
        const kinds = [
          { kind: "resource-kind" as const, extensionId: "example.readers", id: "record" },
          { kind: "resource-kind" as const, extensionId: "example.readers", id: "draft" },
        ];
        w.modePlacements.registerPlacement({
          id: "chat",
          ref: { kind: "placement", extensionId: "example.readers", id: "chat" },
          modeId: "project",
          region: "side",
          item: { kind: "binding", binding: { kinds, view: { kind: "view", id: "chat" }, cardinality: "one" } },
        });
        w.pages.registerPage({
          id: "chat",
          ref: viewerPage("chat"),
          path: "chat",
          parentId: "home",
          modeId: "project",
          resource: { kinds },
          main: { kind: "view", presentation: "page", cardinality: "one", view: { kind: "view", id: "chat" } },
          slots: [],
        });
        w.pages.registerPage({
          id: "compose",
          ref: viewerPage("compose"),
          path: "compose",
          modeId: "project",
          main: { kind: "view", presentation: "page", cardinality: "one", view: { kind: "view", id: "chat" } },
          slots: [],
        });
        await w.navigation.openPage({ page: viewerPage("compose") });
        if (region === "side")
          await w.navigation.openPanel({
            panel: { kind: "placement", extensionId: "example.readers", id: "chat" },
            region: "side",
            resource: viewerResource("compose", "draft"),
          });
        const widget = () => (region === "main" ? w.pages.getContent()! : side());
        const render = () =>
          getWorkbenchRenderers(w)
            .getRenderer("chat")!
            .render({
              workbench: w,
              instance: { ...widget(), instanceId: region, panelId: "chat", closable: true },
              panel: { id: "reader", title: "Chat", region, rendererId: "chat" },
              refresh: () => {},
            } satisfies WorkbenchPanelRenderInput) as ChatElement;
        const sourceResource = widget().resource;
        const source = render();
        const release = source.props.session.retain();
        source.props.session.changeDraft({ text: "First", values: {} });
        await source.props.session.flushDraft();
        const sending = source.props.session.run({ type: "submit", text: "First", attachments: [], values: {} });
        const receipt = source.props.session.getSnapshot().messages[0]!;
        if (stale) {
          if (region === "main")
            await w.navigation.openPage({ page: viewerPage("chat"), resource: viewerResource("picked") });
          else
            await w.navigation.openPanel({
              panel: { kind: "placement", extensionId: "example.readers", id: "chat" },
              region: "side",
              resource: viewerResource("picked"),
            });
        }
        complete({
          outcome: {
            ok: true,
            status: "success",
            value: terminal ? { snapshot: { messages: [], streaming: false } } : {},
            navigationRequests: [
              {
                kind: "viewer",
                operation: "replace",
                from: sourceResource,
                page: viewerPage("chat"),
                resource: viewerResource("created"),
              },
            ],
          },
        });
        await sending;
        const target = render();
        if (stale) {
          expect(widget().resource?.id).toBe("picked");
          expect(target.props.session.getSnapshot().messages).toEqual([]);
          expect(target.key).not.toBe(source.key);
        } else {
          expect(widget().resource?.id).toBe("created");
          expect(target.key).toBe(source.key);
          expect(target.props.conversationKey).toBe(source.props.conversationKey);
          expect(target.props.session).not.toBe(source.props.session);
          expect(target.props.session.getSnapshot().messages[0]).toEqual(receipt);
          target.props.session.accept({ revision: 0, snapshot: { streaming: true } });
          await target.props.session.run({ type: "submit", text: "First", attachments: [], values: {} });
          target.props.session.accept({
            revision: 1,
            snapshot: { queuedFollowUps: [{ id: "later-queue", prompt: "First" }] },
          });
          expect(target.props.session.getSnapshot().pending).toHaveLength(1);
          target.props.session.accept({
            revision: 2,
            snapshot: {
              messages: [
                {
                  id: "optimistic-created",
                  createdAt: 1793923200000,
                  role: "user",
                  parts: [{ type: "text", text: "First" }],
                },
              ],
            },
          });
          expect(target.props.session.getSnapshot().messages[0]?.animationKey).toBe(receipt.id);
          expect(target.props.session.getSnapshot().pending).toBeUndefined();
          for (const [revision, id] of [
            [3, "confirmed-created"],
            [4, "reconfirmed-created"],
          ] as const) {
            confirmMessage(target.props.session, revision, id);
            expect(target.props.session.getSnapshot().messages[0]?.animationKey).toBe(receipt.id);
          }
          const shared = getWorkbenchRenderers(w)
            .getRenderer("chat")!
            .render({
              workbench: w,
              instance: {
                instanceId: "converted",
                panelId: "chat",
                closable: true,
                resource: viewerResource("created"),
              },
              panel: { id: "reader", title: "Chat", region: "side", rendererId: "chat" },
              refresh: () => {},
            }) as ChatElement;
          expect(shared.props.session).toBe(target.props.session);
          if (region === "main") await w.navigation.openPage({ page: viewerPage("compose") });
          else
            await w.navigation.openPanel({
              panel: { kind: "placement", extensionId: "example.readers", id: "chat" },
              region: "side",
              resource: sourceResource,
            });
          const reopened = render();
          expect(reopened.props.session).toBe(source.props.session);
          expect(reopened.key).not.toBe(target.key);
          expect(reopened.props.session.getSnapshot().messages).toEqual([]);
        }
        await source.props.session.flushDraft();
        expect(source.props.session.getSnapshot().draft.text).toBe("");
        if (!stale || terminal) expect(source.props.session.getSnapshot().messages).toEqual([]);
        expect(saved.filter((entry) => entry.key === "compose").at(-1)).toMatchObject({
          key: "compose",
          draft: { text: "", attachments: [] },
        });
        release();
        registered.dispose();
        await w.dispose();
      });
    }
  }
}

test("presentation retains chained canonical identities but respects an unrelated explicit provider key", () => {
  const present = createChatSubmissionPresentation();
  const message = {
    id: "optimistic",
    role: "user" as const,
    createdAt: 1793923200000,
    parts: [{ type: "text" as const, text: "First" }],
  };
  present([{ ...message, animationKey: "pending-input" }]);
  expect(present([{ ...message, id: "confirmed", animationKey: "optimistic" }]).messages[0]?.animationKey).toBe(
    "pending-input",
  );
  expect(present([{ ...message, id: "reconfirmed", animationKey: "optimistic" }]).messages[0]?.animationKey).toBe(
    "pending-input",
  );
  expect(present([{ ...message, id: "reconfirmed", animationKey: "provider-reset" }]).messages[0]?.animationKey).toBe(
    "provider-reset",
  );
  present([]);
  expect(present([{ ...message, id: "confirmed", animationKey: "optimistic" }]).messages[0]?.animationKey).toBe(
    "optimistic",
  );
});
