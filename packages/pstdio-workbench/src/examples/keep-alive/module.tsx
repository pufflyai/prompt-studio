import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import {
  headerTrailingMenuPath,
  type WorkbenchCoreContributionContext,
  type WorkbenchModuleContribution,
} from "../../core";
import { useWorkbenchClaim } from "../../react/keep-alive/use-workbench-claim";
import { StreamingChat } from "./streaming-chat";

const CHAT_RENDERER_ID = "keep-alive.example.chat-renderer";
const CHAT_WIDGET_ID = "keep-alive.example.chat";
const INTRO_WIDGET_ID = "keep-alive.example.intro";
const INTRO_RENDERER_ID = "keep-alive.example.intro-renderer";
const SHOW_DOCKED_COMMAND_ID = "keep-alive.example.showAttached";
const SHOW_FLOATING_COMMAND_ID = "keep-alive.example.showBubble";
const HIDE_CHAT_COMMAND_ID = "keep-alive.example.hideChat";
const CHAT_MODE_CONTEXT_KEY = "keepAliveExample.chatMode";
const DEMO_RESOURCE = {
  kind: "workbench-example",
  uri: "pstdio://examples/keep-alive",
  label: "Keep-alive demo",
};

type ChatPresentation = "docked" | "floating";

const showChat = (ctx: WorkbenchCoreContributionContext, presentation: ChatPresentation) => {
  ctx.layout.openWidget(CHAT_WIDGET_ID);
  ctx.layout.setAreaPresentation("side", presentation);
  ctx.layout.setAreaVisible("side", true);
  ctx.panels.setOpen("side", true);
  ctx.context.set(CHAT_MODE_CONTEXT_KEY, presentation);
};

const hideChat = (ctx: WorkbenchCoreContributionContext) => {
  ctx.layout.setAreaVisible("side", false);
  ctx.panels.setOpen("side", false);
  ctx.context.set(CHAT_MODE_CONTEXT_KEY, "hidden");
};

const KeepAliveChat = () => {
  const claim = useWorkbenchClaim();
  if (!claim) return null;
  return <StreamingChat channel="side panel" />;
};

interface IntroPanelProps {
  onShowDocked: () => void;
  onShowFloating: () => void;
  onHide: () => void;
}

const IntroPanel = (props: IntroPanelProps) => {
  const { onShowDocked, onShowFloating, onHide } = props;

  return (
    <Stack p="lg" gap="md" h="full">
      <Text textStyle="title/S/semibold">Keep-alive demo</Text>
      <Text textStyle="paragraph/M/regular">
        The streaming chat is one keep-alive placement in the side panel. Toggle its presentation — the stream, scroll
        position, and draft input all survive because React never re-mounts the subtree.
      </Text>
      <HStack gap="sm">
        <Button size="sm" onClick={onShowDocked}>
          Dock side panel
        </Button>
        <Button size="sm" onClick={onShowFloating}>
          Float side panel
        </Button>
        <Button size="sm" variant="outline" onClick={onHide}>
          Hide
        </Button>
      </HStack>
      <Box flex="1" />
    </Stack>
  );
};

export const createKeepAliveExampleModule = (): WorkbenchModuleContribution => ({
  id: "keep-alive.example",
  activate(ctx) {
    ctx.resources.registerKind({ kind: DEMO_RESOURCE.kind, label: "Workbench example", surface: "primary" });

    ctx.renderers.registerRenderer({
      id: CHAT_RENDERER_ID,
      keepAlive: true,
      render: () => <KeepAliveChat />,
    });

    ctx.renderers.registerRenderer({
      id: INTRO_RENDERER_ID,
      render: () => (
        <IntroPanel
          onShowDocked={() => showChat(ctx, "docked")}
          onShowFloating={() => showChat(ctx, "floating")}
          onHide={() => hideChat(ctx)}
        />
      ),
    });

    ctx.layout.registerWidget({
      id: INTRO_WIDGET_ID,
      title: "Keep-alive demo",
      area: "main",
      singleton: true,
      rendererId: INTRO_RENDERER_ID,
    });

    ctx.layout.registerWidget({
      id: CHAT_WIDGET_ID,
      title: "Chat",
      area: "side",
      areaCollapsible: true,
      areaSize: { defaultPx: 360, minPx: 280 },
      closable: true,
      singleton: true,
      rendererId: CHAT_RENDERER_ID,
    });

    ctx.commands.registerCommand(
      {
        id: SHOW_DOCKED_COMMAND_ID,
        label: "Dock chat",
        category: "Keep-alive demo",
        when: `${CHAT_MODE_CONTEXT_KEY} != docked`,
      },
      { execute: () => showChat(ctx, "docked") },
    );
    ctx.commands.registerCommand(
      {
        id: SHOW_FLOATING_COMMAND_ID,
        label: "Float chat",
        category: "Keep-alive demo",
        when: `${CHAT_MODE_CONTEXT_KEY} != floating`,
      },
      { execute: () => showChat(ctx, "floating") },
    );
    ctx.commands.registerCommand(
      {
        id: HIDE_CHAT_COMMAND_ID,
        label: "Hide chat",
        category: "Keep-alive demo",
        when: `${CHAT_MODE_CONTEXT_KEY} != hidden`,
      },
      { execute: () => hideChat(ctx) },
    );

    const trailingMenu = headerTrailingMenuPath("main");
    ctx.layout.registerMenuItem(trailingMenu, { commandId: SHOW_DOCKED_COMMAND_ID, group: "keep-alive" });
    ctx.layout.registerMenuItem(trailingMenu, { commandId: SHOW_FLOATING_COMMAND_ID, group: "keep-alive" });
    ctx.layout.registerMenuItem(trailingMenu, { commandId: HIDE_CHAT_COMMAND_ID, group: "keep-alive" });

    ctx.layout.openWidget(INTRO_WIDGET_ID, { resource: DEMO_RESOURCE });
    showChat(ctx, "docked");
  },
});
