import { Box, Button, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { installWebviewKeyboardRelay } from "@pstdio/sdk/extensions";
import { ThemePreferenceProvider, useThemePreference } from "@pstdio/ui";
import { useEffect, useRef, useState } from "react";
import { HtmlPreview } from "./html-preview";

const meta = {
  title: "Extensions/Artifacts/HtmlPreview",
  component: HtmlPreview,
  decorators: [
    (Story) => (
      <Box height="lg">
        <Story />
      </Box>
    ),
  ],
  args: {
    title: "Interactive artifact",
    html: "<h1>Release checklist</h1><p>An interactive, self-contained page.</p><button onclick=\"this.textContent = 'Complete'\">Mark complete</button>",
  },
} satisfies CanvasMeta<typeof HtmlPreview>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Interactive: Story = { id: "extensions-artifacts-htmlpreview--interactive" };
const KeyboardExample = () => {
  const [request, setRequest] = useState("Waiting");
  const heading = useRef<HTMLHeadingElement>(null);
  const target = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => {
    const relay = installWebviewKeyboardRelay({
      shortcuts: () => [
        { id: "leader", entry: "mode", key: "Space", altKey: true, shiftKey: true },
        { id: "tab-four", entry: "tab", key: "4", altKey: true, shiftKey: true },
        { id: "private-command", key: "X", altKey: true, shiftKey: true },
      ],
      dispatch: (input) => {
        if (document.activeElement instanceof HTMLIFrameElement) target.current = document.activeElement;
        setRequest(input.id);
        if (input.id === "leader") heading.current?.focus();
      },
    });
    return () => relay.dispose();
  }, []);
  return (
    <Stack height="full">
      <Box as="h2" tabIndex={-1} ref={heading}>
        Keyboard handoff
      </Box>
      <output aria-label="Keyboard request">{request}</output>
      <Button onClick={() => target.current?.contentWindow?.postMessage({ type: "pstdio.keyboard.restore" }, "*")}>
        Restore editor
      </Button>
      <HtmlPreview
        title="Nested keyboard editor"
        html='<textarea aria-label="Artifact draft">Unsaved artifact</textarea>'
      />
    </Stack>
  );
};
export const KeyboardHandoff: Story = {
  id: "extensions-artifacts-htmlpreview--keyboard-handoff",
  render: () => <KeyboardExample />,
};
export const NavigationIsolation: Story = {
  id: "extensions-artifacts-htmlpreview--navigation-isolation",
  args: {
    title: "Navigation isolation",
    html: `<h1>Local preview</h1>
<button onclick="this.textContent='Complete'">Mark complete</button>
<button onclick="location.href='https://artifact-network.test/script'">Script navigation</button>
<a href="https://artifact-network.test/link">Link navigation</a>
<button onclick="const meta=document.createElement('meta');meta.httpEquiv='refresh';meta.content='0;url=https://artifact-network.test/refresh';document.head.append(meta)">Meta refresh</button>`,
  },
};
export const LongContent: Story = {
  id: "extensions-artifacts-htmlpreview--long-content",
  args: {
    html: `<h1>Release notes</h1>${"<p>A saved update that remains available after the workspace is removed.</p>".repeat(30)}`,
  },
};
const ThemeExample = () => {
  const { toggleThemePreference } = useThemePreference();
  return (
    <Stack height="full">
      <Button onClick={toggleThemePreference}>Toggle theme</Button>
      <HtmlPreview
        title="Theme-aware artifact"
        html={`<style>section{background:var(--artifact-surface);border:1px solid var(--artifact-border);padding:24px}p{color:var(--artifact-muted)}button{color:var(--artifact-accent)}</style><section><h1>Release checklist</h1><p>Theme colors follow the dashboard.</p><button onclick="this.textContent='Complete'">Mark complete</button></section>`}
      />
    </Stack>
  );
};
export const ThemeAware: Story = {
  id: "extensions-artifacts-htmlpreview--theme-aware",
  render: () => (
    <ThemePreferenceProvider initialPreference="pstdio-light">
      <ThemeExample />
    </ThemePreferenceProvider>
  ),
};
