import { Box, Button, Stack } from "@chakra-ui/react";
import { ThemePreferenceProvider, useThemePreference } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
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
} satisfies Meta<typeof HtmlPreview>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {};
export const NavigationIsolation: Story = {
  tags: ["!manifest"],
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
  render: () => (
    <ThemePreferenceProvider initialPreference="pstdio-light">
      <ThemeExample />
    </ThemePreferenceProvider>
  ),
};
