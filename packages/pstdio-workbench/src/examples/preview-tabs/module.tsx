import { Box, Text } from "@chakra-ui/react";
import type { WorkbenchModuleContribution } from "../../core";

const renderer = (label: string) => () => (
  <Box h="full" w="full" p="md" bg="bg">
    <Text textStyle="label/S/medium">{label}</Text>
    <Text mt="xs" textStyle="paragraph/S/regular" color="fg.muted">
      Persistent tabs can be dragged or moved with Alt+Arrow. The italic preview can be promoted from its context menu.
    </Text>
  </Box>
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
        });
        ctx.renderers.registerRenderer({ id, render: renderer(title) });
      }
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
