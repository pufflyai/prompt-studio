import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createChatSession } from "../../../extensions/contributions/chat-session";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { NativeChatAttachmentActions } from "./native-chat-attachments";
import { NativeChatControls } from "./native-chat-controls";
import { NativeChatWorkspace } from "./native-chat-workspace";

const initial = {
  workspace: { controlId: "target", deviceControlId: "machine", create: { actionId: "make-target" } },
  controls: [
    {
      id: "target",
      type: "selection" as const,
      name: "Workspace",
      defaultValue: "a",
      options: [{ id: "a", name: "Existing workspace" }],
    },
    {
      id: "machine",
      type: "selection" as const,
      name: "Device",
      defaultValue: "",
      options: [{ id: "", name: "This device" }],
    },
    { id: "model", type: "text" as const, name: "Model", defaultValue: "model-a" },
  ],
  values: { target: "a", machine: "", model: "model-a" },
};

test("native workspace identity renders once in its hub and leaves other controls in the composer", () => {
  const session = createChatSession({ initial, query: async () => ({}), action: async () => ({}) });
  const props = { conversation: initial, draft: session.getSnapshot().draft, run: session.run, changeValues: () => {} };
  const hub = renderToStaticMarkup(
    <WorkbenchThemeProvider>
      <NativeChatWorkspace {...props} />
    </WorkbenchThemeProvider>,
  );
  const controls = renderToStaticMarkup(
    <WorkbenchThemeProvider>
      <NativeChatControls {...props} />
    </WorkbenchThemeProvider>,
  );
  expect(hub).toContain("Existing workspace");
  expect(hub).toContain("This device");
  expect(controls).not.toContain("Existing workspace");
  expect(controls).not.toContain("This device");
  expect(controls).toContain("Model");
});

test("provider creation inputs survive persistence and delayed creation cannot replace a newer selection", async () => {
  const provider = {
    providerId: "custom.provider",
    params: { image: "custom", nested: { tools: ["a"], enabled: true } },
  };
  let complete!: (result: unknown) => void;
  let saved: unknown;
  const session = createChatSession({
    initial,
    query: async () => ({}),
    action: () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
    saveDraft: async (draft) => {
      saved = draft;
    },
  });
  session.changeDraft({
    text: "Keep text",
    attachments: [{ id: "file", name: "notes.txt" }],
    values: { ...initial.values, target: provider },
  });
  await session.flushDraft();
  expect(saved).toMatchObject({ values: { target: provider } });
  const create = session.run({ type: "operation", id: "make-target", values: session.getSnapshot().draft.values });
  session.changeDraft({ values: { ...session.getSnapshot().draft.values, target: "later", machine: "laptop" } });
  complete({ snapshot: { values: { target: "created", machine: "" } } });
  await create;
  expect(session.getSnapshot().draft).toMatchObject({
    text: "Keep text",
    attachments: [{ id: "file" }],
    values: { target: "later", machine: "laptop" },
  });
});

test("file attachment action is icon-only with its accessible label and tooltip", () => {
  const markup = renderToStaticMarkup(
    <WorkbenchThemeProvider>
      <NativeChatAttachmentActions disabled={false} upload={() => {}} />
    </WorkbenchThemeProvider>,
  );
  expect(markup).toContain('aria-label="Attach files"');
  expect(markup).not.toContain(">Attach files<");
  expect(markup).toContain("<svg");
});

test("a saved remote hub keeps its device name visible while both selectors are read only", () => {
  const conversation = {
    ...initial,
    controls: initial.controls.map((control) => ({ ...control, readOnly: true })),
    values: { ...initial.values, machine: "laptop" },
  };
  conversation.controls[1] = {
    ...conversation.controls[1],
    options: [{ id: "laptop", name: "Research laptop" }],
  } as (typeof conversation.controls)[1];
  const markup = renderToStaticMarkup(
    <WorkbenchThemeProvider>
      <NativeChatWorkspace
        conversation={conversation}
        draft={{ text: "Keep", attachments: [], values: conversation.values }}
        run={async () => ({})}
        changeValues={() => {}}
      />
    </WorkbenchThemeProvider>,
  );
  expect(markup).toContain("Research laptop");
  expect(markup).toContain("Existing workspace");
  expect(markup).toContain('aria-label="Select device" disabled');
});

test("a workspace menu opened before another control edit dispatches the latest accepted values", () => {
  const session = createChatSession({ initial, query: async () => ({}), action: async () => ({}) });
  const view = NativeChatWorkspace({
    conversation: initial,
    draft: session.getSnapshot().draft,
    run: session.run,
    changeValues: (next) =>
      session.changeDraft({ values: typeof next === "function" ? next(session.getSnapshot().draft.values) : next }),
  });
  const selector = view.props.children[0].props.workspaceControl.props.children[1];
  const menu = selector.type(selector.props);
  session.changeDraft({ values: { ...session.getSnapshot().draft.values, model: "model-b" } });
  menu.props.items[0].onSelect();
  expect(session.getSnapshot().draft.values.model).toBe("model-b");
  expect(session.getSnapshot().draft.values.target).toBe("a");
});
