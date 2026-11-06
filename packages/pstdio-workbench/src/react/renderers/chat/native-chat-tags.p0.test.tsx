import { expect, test } from "bun:test";
import { chatRendererSnapshotSchema } from "pstdio-api-contracts";
import { NativeChatControls, NativeChatHarnessControls } from "./native-chat-controls";

test("draft and submitted native input tags coexist and hide through provider actions without requiring discovered modes", async () => {
  const conversation = chatRendererSnapshotSchema.parse({
    draftTag: { label: "Plan", description: "New objective", clearActionId: "clear-draft" },
    sentTag: {
      label: "Goal",
      description: "Native status is not confirmed",
      clearActionId: "hide-sent",
      closeLabel: "Hide submitted goal",
    },
  });
  const actions: unknown[] = [];
  const tags = NativeChatHarnessControls({
    conversation,
    draft: { text: "Unsent", attachments: [], values: { provider: "B" } },
    run: async (action) => {
      actions.push(action);
    },
  })!;
  expect(tags.props.modes).toEqual([]);
  expect(tags.props.draftTag.label).toBe("Plan");
  expect(tags.props.sentTag.closeLabel).toBe("Hide submitted goal");
  tags.props.sentTag.onClose();
  await Promise.resolve();
  expect(actions).toEqual([{ type: "operation", id: "hide-sent", values: { provider: "B" } }]);
});

test("read-only conversations can reconnect through explicit host refresh without executing provider mutations", () => {
  let refreshes = 0;
  const actions: unknown[] = [];
  const controls = NativeChatControls({
    conversation: chatRendererSnapshotSchema.parse({
      readOnly: true,
      operations: [
        { id: "connection", label: "Check connection", refresh: true },
        { id: "mutate", label: "Change data" },
      ],
    }),
    draft: { text: "Keep draft", attachments: [], values: {} },
    run: async (action) => {
      actions.push(action);
    },
    changeValues: () => {},
    reconnect: () => {
      refreshes++;
    },
  });
  const buttons = controls.props.children[2].props.children;
  expect(buttons[0].props.disabled).toBeFalsy();
  expect(buttons[1].props.disabled).toBe(true);
  buttons[0].props.onClick();
  expect(refreshes).toBe(1);
  expect(actions).toEqual([]);
});
