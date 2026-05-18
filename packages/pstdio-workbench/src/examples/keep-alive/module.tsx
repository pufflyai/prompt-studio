import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import {
  headerTrailingMenuPath,
  type WorkbenchCoreContributionContext,
  type WorkbenchModuleContribution,
  type WorkbenchSessionPanelMode,
} from "../../core";
import { useWorkbenchClaim } from "../../react/keep-alive/use-workbench-claim";
import { StreamingChat } from "./streaming-chat";

const CHAT_RENDERER_ID = "keep-alive.example.chat-renderer";
const ATTACHED_WIDGET_ID = "keep-alive.example.chat-attached";
const BUBBLE_WIDGET_ID = "keep-alive.example.chat-bubble";
const INTRO_WIDGET_ID = "keep-alive.example.intro";
const INTRO_RENDERER_ID = "keep-alive.example.intro-renderer";
const SHOW_ATTACHED_COMMAND_ID = "keep-alive.example.showAttached";
const SHOW_BUBBLE_COMMAND_ID = "keep-alive.example.showBubble";
const HIDE_CHAT_COMMAND_ID = "keep-alive.example.hideChat";
const CHAT_MODE_CONTEXT_KEY = "keepAliveExample.chatMode";

// The bubble's chrome buttons (close, pop-out) call workbench.sessionPanel.setMode
// directly — see `WorkbenchSessionBubbleContainer` in react/session-panel. Drive
// the whole demo from sessionPanel so those built-in actions stay coherent.
const applyChatMode = (ctx: WorkbenchCoreContributionContext, mode: WorkbenchSessionPanelMode) => {
  if (mode === "attached") {
    ctx.layout.removeWidgetPlacement(BUBBLE_WIDGET_ID);
    ctx.layout.openWidget(ATTACHED_WIDGET_ID);
  } else if (mode === "bubble") {
    ctx.layout.removeWidgetPlacement(ATTACHED_WIDGET_ID);
    ctx.layout.openWidget(BUBBLE_WIDGET_ID);
  } else {
    ctx.layout.removeWidgetPlacement(ATTACHED_WIDGET_ID);
    ctx.layout.removeWidgetPlacement(BUBBLE_WIDGET_ID);
  }
  ctx.context.set(CHAT_MODE_CONTEXT_KEY, mode);
};

// Subscribes to whichever widget currently claims the persistent chat host so
// the title reflects "attached" or "bubble" without remounting the subtree.
const KeepAliveChat = () => {
  const claim = useWorkbenchClaim();
  const channel = claim?.widget.id === BUBBLE_WIDGET_ID ? "bubble" : "attached";
  return <StreamingChat channel={channel} />;
};

interface IntroPanelProps {
  onShowAttached: () => void;
  onShowBubble: () => void;
  onHide: () => void;
}

const IntroPanel = (props: IntroPanelProps) => {
  const { onShowAttached, onShowBubble, onHide } = props;

  return (
    <Stack p="lg" gap="md" h="full">
      <Text textStyle="title/S/semibold">Keep-alive demo</Text>
      <Text textStyle="paragraph/M/regular">
        The streaming chat below is registered once with a keep-alive renderer. Two widgets (attached panel, bubble)
        point at the same `rendererId` and reveal the same subtree in different areas. Toggle between them — the stream,
        scroll position, and draft input all survive because React never re-mounts the subtree.
      </Text>
      <HStack gap="sm">
        <Button size="sm" onClick={onShowAttached}>
          Attach to main-right
        </Button>
        <Button size="sm" onClick={onShowBubble}>
          Move to floating bubble
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
    ctx.renderers.registerRenderer({
      id: CHAT_RENDERER_ID,
      keepAlive: true,
      render: () => <KeepAliveChat />,
    });

    ctx.renderers.registerRenderer({
      id: INTRO_RENDERER_ID,
      render: () => (
        <IntroPanel
          onShowAttached={() => ctx.sessionPanel.setMode("attached")}
          onShowBubble={() => ctx.sessionPanel.setMode("bubble")}
          onHide={() => ctx.sessionPanel.setMode("closed")}
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
      id: ATTACHED_WIDGET_ID,
      title: "Chat (attached)",
      area: "main-right",
      areaSize: { defaultPx: 360, minPx: 280 },
      closable: true,
      singleton: true,
      rendererId: CHAT_RENDERER_ID,
    });

    ctx.layout.registerWidget({
      id: BUBBLE_WIDGET_ID,
      title: "Chat (bubble)",
      area: "floating",
      areaSize: { defaultPx: 360, minPx: 280 },
      closable: true,
      singleton: true,
      rendererId: CHAT_RENDERER_ID,
    });

    ctx.commands.registerCommand(
      {
        id: SHOW_ATTACHED_COMMAND_ID,
        label: "Attach chat",
        category: "Keep-alive demo",
        when: `${CHAT_MODE_CONTEXT_KEY} != attached`,
      },
      { execute: () => ctx.sessionPanel.setMode("attached") },
    );
    ctx.commands.registerCommand(
      {
        id: SHOW_BUBBLE_COMMAND_ID,
        label: "Float chat",
        category: "Keep-alive demo",
        when: `${CHAT_MODE_CONTEXT_KEY} != bubble`,
      },
      { execute: () => ctx.sessionPanel.setMode("bubble") },
    );
    ctx.commands.registerCommand(
      {
        id: HIDE_CHAT_COMMAND_ID,
        label: "Hide chat",
        category: "Keep-alive demo",
        when: `${CHAT_MODE_CONTEXT_KEY} != closed`,
      },
      { execute: () => ctx.sessionPanel.setMode("closed") },
    );

    const trailingMenu = headerTrailingMenuPath("main");
    ctx.layout.registerMenuItem(trailingMenu, { commandId: SHOW_ATTACHED_COMMAND_ID, group: "keep-alive" });
    ctx.layout.registerMenuItem(trailingMenu, { commandId: SHOW_BUBBLE_COMMAND_ID, group: "keep-alive" });
    ctx.layout.registerMenuItem(trailingMenu, { commandId: HIDE_CHAT_COMMAND_ID, group: "keep-alive" });

    ctx.layout.openWidget(INTRO_WIDGET_ID);

    // Mirror sessionPanel into widget activation. This also captures the
    // bubble chrome's built-in "close" / "pop-out" buttons, which call
    // sessionPanel.setMode directly.
    const subscription = ctx.sessionPanel.onDidChange((mode) => applyChatMode(ctx, mode));
    applyChatMode(ctx, ctx.sessionPanel.getMode());

    return subscription;
  },
});
