import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { StrictMode } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import * as Y from "yjs";
import type {
  NativeDocumentSession,
  NativeDocumentSessionSnapshot,
} from "../../../core/native-documents/native-document-session";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
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
