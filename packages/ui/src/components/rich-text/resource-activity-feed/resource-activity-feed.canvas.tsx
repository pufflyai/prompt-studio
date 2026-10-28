import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { ResourceActivityFeed, type ResourceActivityFeedItem } from "./resource-activity-feed";

const attentionItem: ResourceActivityFeedItem = {
  id: "input-request",
  kind: "message",
  createdAt: "2026-08-24T10:48:00.000Z",
  timestampLabel: "10:48",
  actor: { name: "Planner Agent" },
  markdown:
    "Which workspace should be treated as canonical?\n\nChoose `PS-276_A1` or the current branch before the next attempt starts.",
  attention: {
    statusLabel: "Awaiting input",
    icon: "bell",
    actions: [
      { id: "open-session", label: "Open session", icon: "message-circle" },
      { id: "open-ticket", label: "Open ticket", icon: "component" },
    ],
  },
};
const mixedItems: ResourceActivityFeedItem[] = [
  {
    id: "review-note",
    kind: "message",
    createdAt: "2026-08-23T15:45:00.000Z",
    timestampLabel: "yesterday",
    actor: { name: "Sam Rivera" },
    markdown:
      "The component should keep routing outside `@pstdio/ui`.\n\n- Keep item data serializable\n- Use stable IDs for keys",
    relatedResources: [{ id: "design-note", type: "document", label: "Design note" }],
  },
  {
    id: "status-change",
    kind: "event",
    createdAt: "2026-08-20T10:30:00.000Z",
    timestampLabel: "4 days ago",
    actor: { name: "Jordan Lee" },
    icon: "activity",
    summary: "moved the ticket from Backlog to Todo",
    relatedResources: [{ id: "PS-287", type: "ticket", label: "PS-287" }],
  },
  {
    id: "created",
    kind: "event",
    createdAt: "2026-08-20T08:15:00.000Z",
    timestampLabel: "4 days ago",
    actor: { name: "System" },
    icon: "component",
    summary: "created this resource",
  },
];
const longContentItems: ResourceActivityFeedItem[] = [
  {
    id: "long-message",
    kind: "message",
    createdAt: "2026-08-24T08:00:00.000Z",
    timestampLabel: "1 hour ago",
    actor: { name: "Release bot" },
    markdown: `## Validation notes

The activity feed accepts events and markdown messages through one typed item union. It preserves the supplied order and keeps resource navigation in caller callbacks.

### Checks

1. Loading, empty, error, and pagination states remain visible to assistive technology.
2. Long markdown wraps inside the existing comment component.
3. Related resources use buttons, so keyboard and pointer users trigger the same callback.

\`\`\`ts
const item = {
  id: "event-1",
  kind: "event",
  createdAt: "2026-08-24T08:00:00.000Z",
  summary: "published a revision",
};
\`\`\`
`,
  },
];
const wideItems: ResourceActivityFeedItem[] = [
  attentionItem,
  {
    id: "workspace-created",
    kind: "event",
    createdAt: "2026-08-24T10:46:00.000Z",
    timestampLabel: "10:46",
    actor: { name: "System Agent" },
    icon: "git-branch",
    summary: "created a worktree-backed workspace",
    relatedResources: [{ id: "PS-276_A1", type: "workspace", label: "PS-276_A1" }],
  },
  {
    id: "refinement-started",
    kind: "event",
    createdAt: "2026-08-24T10:42:00.000Z",
    timestampLabel: "10:42",
    actor: { name: "Planner Agent" },
    icon: "sparkles",
    summary: "started a refinement session",
    relatedResources: [{ id: "PS-276", type: "ticket", label: "Refine PS-276" }],
  },
];
const meta = {
  title: "Components/Data Display/Resource Activity Feed",
  component: ResourceActivityFeed,
  tags: ["ps-287"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story, context) => (
      <ScrollArea height="100vh" background="bg" color="fg" contentProps={{ padding: { base: "md", md: "xl" } }}>
        <Box width="full" maxWidth={context.parameters.feedWidth ?? "820px"} marginX="auto">
          <Story />
        </Box>
      </ScrollArea>
    ),
  ],
} satisfies CanvasMeta<typeof ResourceActivityFeed>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const MixedActivity: Story = {
  id: "components-data-display-resource-activity-feed--mixed-activity",
  args: {
    items: mixedItems,
    hasMore: true,
    onLoadMore: () => undefined,
    onRelatedResourceSelect: () => undefined,
  },
};
export const AttentionMessage: Story = {
  id: "components-data-display-resource-activity-feed--attention-message",
  args: {
    items: [attentionItem],
    onActionSelect: () => undefined,
  },
};
export const Empty: Story = {
  id: "components-data-display-resource-activity-feed--empty",
  args: { items: [] },
};
export const Loading: Story = {
  id: "components-data-display-resource-activity-feed--loading",
  args: { items: [], isLoading: true },
};
export const ErrorState: Story = {
  id: "components-data-display-resource-activity-feed--error-state",
  args: { items: [], error: "The activity service did not respond." },
};
export const LongContent: Story = {
  id: "components-data-display-resource-activity-feed--long-content",
  args: { items: longContentItems },
};
export const WideContent: Story = {
  id: "components-data-display-resource-activity-feed--wide-content",
  args: {
    items: wideItems,
    onActionSelect: () => undefined,
    onRelatedResourceSelect: () => undefined,
  },
  parameters: { feedWidth: "1100px" },
};
export const PanelMenu: Story = {
  id: "components-data-display-resource-activity-feed--panel-menu",
  args: {
    items: [attentionItem, ...mixedItems.slice(0, 2)],
    size: "compact",
    onActionSelect: () => undefined,
    onRelatedResourceSelect: () => undefined,
  },
  parameters: { feedWidth: "320px" },
};
export const PanelMenuDark: Story = {
  id: "components-data-display-resource-activity-feed--panel-menu-dark",
  ...PanelMenu,
  globals: { theme: "pstdio-dark" },
};
export const DarkMode: Story = {
  id: "components-data-display-resource-activity-feed--dark-mode",
  args: {
    items: [attentionItem, ...mixedItems],
    hasMore: true,
    onActionSelect: () => undefined,
    onLoadMore: () => undefined,
    onRelatedResourceSelect: () => undefined,
  },
  globals: { theme: "pstdio-dark" },
};
