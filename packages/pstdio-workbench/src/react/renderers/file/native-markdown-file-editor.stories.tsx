import { Box, Button } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { StrictMode, useRef, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import * as Y from "yjs";
import type {
  NativeDocumentSession,
  NativeDocumentSessionSnapshot,
} from "../../../core/native-documents/native-document-session";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { FileRendererContentView } from "./file-renderer-content";
import { NativeMarkdownFileEditor } from "./native-markdown-file-editor";

const createStorySession = (offline = false): NativeDocumentSession => {
  const document = new Y.Doc();
  document.getText("content").insert(0, "# Build together\n\nStart with the next step.");
  let state: NativeDocumentSessionSnapshot = { document, pending: false, connected: !offline, participants: [] };
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<NativeDocumentSessionSnapshot>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  const acknowledge = async () => {
    publish({ pending: false, connected: true, error: undefined });
  };
  document.on("update", () => {
    publish({ pending: true });
    if (state.connected)
      queueMicrotask(() => {
        publish({ pending: false });
      });
    else publish({ error: "Changes are waiting to be saved." });
  });
  return {
    setSelection: async () => {},
    start: async () => {},
    flush: acknowledge,
    retry: acknowledge,
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close: async () => {
      document.destroy();
      listeners.clear();
    },
  };
};
const meta = {
  title: "Renderers/Native Markdown File Editor",
  component: NativeMarkdownFileEditor,
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Box h="lg">
          <Story />
        </Box>
      </WorkbenchThemeProvider>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "The host session owns text and local-save acknowledgement. These local story fixtures illustrate view states; real transport is checked separately.",
      },
    },
  },
} satisfies Meta<typeof NativeMarkdownFileEditor>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Editing: Story = {
  args: { connect: () => createStorySession() },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('[contenteditable="true"]')).not.toBeNull());
    const editor = canvasElement.querySelector<HTMLElement>('[contenteditable="true"]')!;
    await userEvent.click(editor);
    await userEvent.keyboard("Working ");
    await expect(editor).toHaveTextContent("Working");
  },
};
export const Reconnecting: Story = {
  args: { connect: () => createStorySession(true) },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('[contenteditable="true"]')).not.toBeNull());
    await userEvent.click(canvasElement.querySelector<HTMLElement>('[contenteditable="true"]')!);
    await userEvent.keyboard("Local ");
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Retry" }));
    await expect(within(canvasElement).queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  },
};
export const StrictEffects: Story = {
  ...Editing,
  render: (args) => (
    <StrictMode>
      <NativeMarkdownFileEditor {...args} />
    </StrictMode>
  ),
  tags: ["!manifest"],
};

const RenamedResource = () => {
  const [title, setTitle] = useState("Planning note");
  const rendererRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <Button onClick={() => setTitle("Renamed planning note")}>Rename note</Button>
      <FileRendererContentView
        content={{
          fileName: "opaque-storage-id.md",
          mimeType: "text/markdown",
          content: "Text",
          editable: true,
          documentSource: { kind: "workspace", path: "note.md" },
        }}
        editorKey="same-source"
        title={title}
        rendererRef={rendererRef}
        errorNotice={null}
        contributionCanSave
        onChange={() => {}}
        connectDocument={() => createStorySession()}
      />
    </>
  );
};
export const ResourceTitle: Story = {
  args: { connect: () => createStorySession() },
  render: () => <RenamedResource />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvasElement.querySelector('[contenteditable="true"]')).not.toBeNull());
    const editor = canvasElement.querySelector('[contenteditable="true"]');
    await expect(canvas.getByText("Planning note", { exact: true })).toBeVisible();
    await expect(canvas.queryByText("opaque-storage-id.md")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Rename note" }));
    await expect(canvas.getByText("Renamed planning note", { exact: true })).toBeVisible();
    await expect(canvasElement.querySelector('[contenteditable="true"]')).toBe(editor);
  },
};
