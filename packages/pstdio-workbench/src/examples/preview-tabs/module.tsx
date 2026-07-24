import { Box, Menu, Text } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import type { WorkbenchModuleContribution } from "../../core";

const sessionMenuRendererId = "preview-tabs.session-menu";

const renderer = (label: string) => () => (
  <Box h="full" w="full" p="md" bg="bg">
    <Text textStyle="label/S/medium">{label}</Text>
    <Text mt="xs" textStyle="paragraph/S/regular" color="fg.muted">
      Click the active Session tab to open its custom menu. Right-click the italic preview to Keep Open. Persistent tabs
      can be dragged or moved with Alt+Arrow.
    </Text>
  </Box>
);

const SessionTabMenu = () => (
  <>
    <Menu.Item value="new-session" asChild>
      <ListRow asChild variant="full-width" id="new-session" label="New session" onActivate={() => undefined} />
    </Menu.Item>
    <Menu.Separator />
    <Menu.Item value="session-42" asChild>
      <ListRow
        asChild
        variant="full-width"
        id="session-42"
        label="Session 42"
        isSelected
        onActivate={() => undefined}
      />
    </Menu.Item>
    <Menu.Item value="session-17" asChild>
      <ListRow asChild variant="full-width" id="session-17" label="Session 17" onActivate={() => undefined} />
    </Menu.Item>
  </>
);

export const createPreviewTabsExampleModule = () =>
  ({
    id: "preview-tabs-story",
    activate(ctx) {
      ctx.resources.registerKind({ kind: "workspace", label: "Workspace", icon: "GitBranch" });
      ctx.resources.registerKind({ kind: "session", label: "Session", icon: "MessageCircle" });
      ctx.layout.registerLocation({
        id: "preview-tabs.workspace",
        title: "Workspace",
        region: "main",
        rendererId: "preview-tabs.workspace",
      });
      for (const [id, title, icon] of [
        ["preview-tabs.files", "Files", "Files"],
        ["preview-tabs.terminal", "Terminal", "SquareTerminal"],
        ["preview-tabs.session", "Session 42", "MessageCircle"],
      ] as const) {
        ctx.layout.registerSubPanel({
          id,
          title,
          icon,
          region: "side",
          singleton: false,
          closable: true,
          rendererId: id,
          tab: id === "preview-tabs.session" ? { customMenuRendererId: sessionMenuRendererId } : undefined,
        });
        ctx.renderers.registerRenderer({ id, render: renderer(title) });
      }
      ctx.renderers.registerRenderer({ id: sessionMenuRendererId, render: () => <SessionTabMenu /> });
      ctx.renderers.registerRenderer({
        id: "preview-tabs.workspace",
        render: renderer("Workspace"),
      });
      ctx.layout.openWidget("preview-tabs.workspace", {
        resource: { kind: "workspace", uri: "story://workspace/alpha", label: "Workspace Alpha" },
      });
      ctx.layout.openWidget("preview-tabs.files", { tabRetention: "persistent" });
      ctx.layout.openWidget("preview-tabs.terminal", { tabRetention: "persistent" });
      ctx.layout.openWidget("preview-tabs.session", {
        resource: { kind: "session", uri: "story://session/42", label: "Session 42" },
        tabPosition: "start",
        tabRetention: "preview",
      });
    },
  }) satisfies WorkbenchModuleContribution;
