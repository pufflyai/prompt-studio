import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { StrictMode } from "react";

import * as Y from "yjs";
import type {
  NativeDocumentSession,
  NativeDocumentSessionSnapshot,
} from "../../../core/native-documents/native-document-session";
import { createWorkbenchPresence } from "../../../core/presence/workbench-presence";
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
    setOpen: () => {},
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
  args: { presence: createWorkbenchPresence(), open: true },
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
} satisfies CanvasMeta<typeof NativeMarkdownFileEditor>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Editing: Story = {
  id: "renderers-native-markdown-file-editor--editing",
  args: { connect: () => createStorySession() },
};
export const Reconnecting: Story = {
  id: "renderers-native-markdown-file-editor--reconnecting",
  args: { connect: () => createStorySession(true) },
};
export const StrictEffects: Story = {
  id: "renderers-native-markdown-file-editor--strict-effects",
  ...Editing,
  render: (args) => (
    <StrictMode>
      <NativeMarkdownFileEditor {...args} />
    </StrictMode>
  ),
  tags: ["!manifest"],
};
