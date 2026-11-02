import { Stack } from "@chakra-ui/react";
import { Circle, FolderGit2, MessageSquare } from "lucide-react";
import { KanbanRendererList } from "./kanban-renderer-list";
import { KanbanRendererSkeleton } from "./kanban-renderer-skeleton";
import { KanbanRendererToolbar } from "./kanban-renderer-toolbar";

// Source: PR #1298, b32912e0b75897a05a303c64d23444aac7b0dfc5,
// design/prompt-studio-design-system.pen, Resource List Renderer · Component.
export default { title: "Patterns/Resource List/Design", fullscreen: true };

export const GroupedAndNested = () => (
  <Stack height="full" minH="0" gap="0">
    <KanbanRendererToolbar
      resourceList
      rows={[]}
      storageKey="resource-list-design"
      attributes={[]}
      defaultSettings={{ viewMode: "list" }}
      search=""
      onSearchChange={() => {}}
    />
    <KanbanRendererList
      items={[
        {
          id: "device",
          title: "This device",
          isGroup: true,
          countBadge: 1,
          statusIcon: Circle,
          statusColorPalette: "green",
          children: [
            {
              id: "workspace",
              eyebrow: "WS-12",
              title: "Improve search",
              statusIcon: FolderGit2,
              badges: [{ attributeId: "updated", label: "Oct 12" }],
              contextMenuActions: [{ key: "open", label: "Open", onClick: () => {} }],
              children: [{ id: "session", title: "Check search results", statusIcon: MessageSquare }],
            },
          ],
        },
      ]}
    />
  </Stack>
);

export const Loading = () => <KanbanRendererSkeleton viewMode="list" />;
