import { expect, test } from "bun:test";
import type { ChatRendererSnapshot } from "@pstdio/sdk/extensions";
import type { ComponentProps, ReactElement } from "react";
import { createChatSession } from "../../../extensions/contributions/chat-session";
import { HarnessControl } from "../controls/harness-control";
import { NativeChatControls } from "./native-chat-controls";

// Exercise the actual native-to-host field binding: enabled harness fields may
// automatically select the project's default before the user opens the picker.
const harnessField = (session: ReturnType<typeof createChatSession>) => {
  const { conversation, draft, initializing } = session.getSnapshot();
  const element = NativeChatControls({
    conversation,
    draft,
    initializing,
    run: session.run,
    changeValues: (values) => session.changeDraft({ values }),
  }) as ReactElement<{ children: ReactElement[] }>;
  const editor = element.props.children[1] as ReactElement<{
    params: { value: ReactElement<ComponentProps<typeof HarnessControl>> }[];
  }>;
  let disabled: boolean | undefined;
  const control = editor.props.params[0]!.value;
  HarnessControl({
    ...control.props,
    renderParamField: (field) => {
      disabled = field.disabled;
      if (!field.disabled) field.onChange(JSON.stringify({ harnessId: "project-default" }));
      return <span />;
    },
  });
  return disabled;
};

test("native harness initialization cannot replace saved session identity with project defaults", async () => {
  let resolveQuery!: (value: ChatRendererSnapshot) => void;
  let resolveDraft!: (value: unknown) => void;
  const session = createChatSession({
    initial: {
      controls: [{ id: "harness", name: "Harness", type: "harness", defaultValue: { harnessId: "" } }],
    },
    query: () =>
      new Promise((resolve) => {
        resolveQuery = resolve;
      }),
    loadDraft: () =>
      new Promise((resolve) => {
        resolveDraft = resolve;
      }),
    action: async () => undefined,
  });
  const release = session.retain();
  expect(harnessField(session)).toBe(true);
  resolveDraft({ text: "", attachments: [], values: { harness: { harnessId: "session-harness", model: "B" } } });
  await Promise.resolve();
  expect(harnessField(session)).toBe(true);
  resolveQuery({
    controls: [
      { id: "harness", name: "Harness", type: "harness", lockIdentity: true, defaultValue: { harnessId: "" } },
    ],
    values: { harness: { harnessId: "session-harness", model: "A" } },
  });
  await new Promise((done) => setTimeout(done, 0));
  expect(session.getSnapshot().initializing).toBe(false);
  expect(session.getSnapshot().draft.values.harness).toEqual({ harnessId: "session-harness", model: "B" });
  release();
});
