import { Button, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useEffect, useState } from "react";
import { PromptEditor, type PromptEditorProps } from "./prompt-input";
import { generateEditorStateFromString } from "./utils";

const meta: CanvasMeta<typeof PromptEditor> = {
  title: "Patterns/Editors/Prompt Editor",
  component: PromptEditor,
  args: {
    defaultState: JSON.stringify(generateEditorStateFromString()),
    commands: [
      { name: "/plan", description: "Select native planning.", argumentHelp: "[task]" },
      { name: "/compact", description: "Compact this thread." },
    ],
  },
};
export default meta;
type Story = CanvasFrame<typeof PromptEditor>;
export const Basic: Story = {
  id: "patterns-editors-prompt-editor--basic",
};
export const ReadOnly: Story = {
  id: "patterns-editors-prompt-editor--read-only",
  args: { isEditable: false },
};
export const DebugView: Story = {
  id: "patterns-editors-prompt-editor--debug-view",
  args: { debug: true },
};
export const SlashPopover: Story = {
  id: "patterns-editors-prompt-editor--slash-popover",
};
export const FilterAndTab: Story = {
  id: "patterns-editors-prompt-editor--filter-and-tab",
};
export const DismissPopover: Story = {
  id: "patterns-editors-prompt-editor--dismiss-popover",
};
export const MultilineDraft: Story = {
  id: "patterns-editors-prompt-editor--multiline-draft",
};
const DiscoveringCommands = (props: PromptEditorProps) => {
  const { commands = [], ...editorProps } = props;
  const [query, setQuery] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (query !== "/" || ready) return;
    const timer = setTimeout(() => setReady(true), 250);
    return () => clearTimeout(timer);
  }, [query, ready]);
  return <PromptEditor {...editorProps} commands={ready ? commands : []} onChange={setQuery} />;
};
export const DelayedDiscovery: Story = {
  id: "patterns-editors-prompt-editor--delayed-discovery",
  render: (args) => <DiscoveringCommands {...args} />,
};
// The editor owns focus: a request made while it is locked lands once it becomes editable.
const LockedFocusRequest = (props: PromptEditorProps) => {
  const [editable, setEditable] = useState(false);
  const [requested, setRequested] = useState(true);
  return (
    <Stack gap="xs">
      <PromptEditor
        {...props}
        isEditable={editable}
        focusRequested={requested}
        onFocusRequestComplete={() => setRequested(false)}
      />
      <Button size="xs" variant="outline" alignSelf="start" onClick={() => setEditable(true)}>
        Unlock
      </Button>
    </Stack>
  );
};
export const FocusRequest: Story = {
  id: "patterns-editors-prompt-editor--focus-request",
  render: (args) => <LockedFocusRequest {...args} />,
};
