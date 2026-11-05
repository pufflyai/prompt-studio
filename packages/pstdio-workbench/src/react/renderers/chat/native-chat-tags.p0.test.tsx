import { expect, test } from "bun:test";
import { chatRendererSnapshotSchema } from "pstdio-api-contracts";
import { NativeChatControls } from "./native-chat-controls";

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
  const controls = NativeChatControls({
    conversation,
    draft: { text: "Unsent", attachments: [], values: { provider: "B" } },
    run: async (action) => {
      actions.push(action);
    },
    changeValues: () => {},
  });
  const tags = controls.props.children[0];
  expect(tags.props.modes).toEqual([]);
  expect(tags.props.draftTag.label).toBe("Plan");
  expect(tags.props.sentTag.closeLabel).toBe("Hide submitted goal");
  tags.props.sentTag.onClose();
  await Promise.resolve();
  expect(actions).toEqual([{ type: "operation", id: "hide-sent", values: { provider: "B" } }]);
});
