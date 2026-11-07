import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createChatSession } from "../../../extensions/contributions/chat-session";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { NativeChatAttachmentActions } from "./native-chat-attachments";
import { NativeChatControls } from "./native-chat-controls";
import { NativeChatWorkspace } from "./native-chat-workspace";

const initial = {
  workspace: { controlId: "target", deviceControlId: "machine" },
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
  expect(hub).not.toContain('aria-label="Select device"');
  expect(controls).not.toContain("Existing workspace");
  expect(controls).not.toContain("This device");
  expect(controls).toContain("Model");
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
  expect(markup).toContain('data-testid="session-device"');
  expect(markup).not.toContain('aria-label="Select device"');
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
  session.changeDraft({ values: { ...session.getSnapshot().draft.values, model: "model-b" } });
  selector.props.onSelectWorkspace("a");
  expect(session.getSnapshot().draft.values.model).toBe("model-b");
  expect(session.getSnapshot().draft.values.target).toBe("a");
});

test("owner-provided workspace navigation remains available in read-only chat with a visible matching choice", () => {
  const render = (
    readOnly: boolean,
    value: string | undefined,
    options = [{ id: "a", name: "Existing workspace" }],
    unavailable = false,
  ) =>
    renderToStaticMarkup(
      <WorkbenchThemeProvider>
        <NativeChatWorkspace
          conversation={{
            ...initial,
            readOnly: unavailable,
            workspace: { controlId: "target", openResourceId: "a" },
            controls: [{ id: "target", type: "selection", name: "Workspace", defaultValue: "a", readOnly, options }],
          }}
          draft={{ text: "Keep", attachments: [], values: value === undefined ? {} : { target: value } }}
          run={async () => ({})}
          changeValues={() => {}}
        />
      </WorkbenchThemeProvider>,
    );
  expect(render(false, undefined)).toContain('aria-label="Open workspace"');
  expect(render(false, "unknown")).not.toContain('aria-label="Open workspace"');
  expect(render(false, "a")).toContain('aria-label="Open workspace"');
  expect(render(false, "")).not.toContain('aria-label="Open workspace"');
  expect(render(true, "a", [])).not.toContain('aria-label="Open workspace"');
  expect(render(true, "a", undefined, true)).toContain('aria-label="Open workspace"');
  expect(render(true, "a")).toContain('aria-label="Open workspace"');
});

test("device selection exists only with multiple choices; saved remote identity stays read-only", () => {
  const render = (options: { id: string; name: string }[], readOnly = false) =>
    renderToStaticMarkup(
      <WorkbenchThemeProvider>
        <NativeChatWorkspace
          conversation={{
            workspace: { controlId: "target", deviceControlId: "machine" },
            controls: [{ id: "machine", name: "Device", type: "selection", defaultValue: "laptop", readOnly, options }],
          }}
          draft={{ text: "Keep", attachments: [], values: { machine: "laptop" } }}
          run={async () => ({})}
          changeValues={() => {}}
        />
      </WorkbenchThemeProvider>,
    );
  expect(render([])).not.toContain('aria-label="Select device"');
  expect(render([{ id: "", name: "This device" }])).not.toContain('aria-label="Select device"');
  expect(
    render([
      { id: "", name: "This device" },
      { id: "laptop", name: "Laptop" },
    ]),
  ).toContain('aria-label="Select device"');
  const saved = render([{ id: "laptop", name: "Laptop" }], true);
  expect(saved).toContain('data-testid="session-device"');
  expect(saved).not.toContain('aria-label="Select device"');
});
