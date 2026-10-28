import { Button } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { ChatLinkHandler } from "../links/chat-link";
import { ChatPanel } from "./chat-panel";

const meta: Meta<typeof ChatPanel> = { title: "Chat/ChatPanel/Images", component: ChatPanel };
export default meta;
type Story = StoryObj<typeof ChatPanel>;

const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9i8AAAAASUVORK5CYII=";
const secondImage = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export const CapturedLocalImage: Story = {
  args: {
    messages: [
      { id: "user", role: "user", parts: [{ type: "text", text: "Show the screenshot." }] },
      {
        id: "tool",
        role: "assistant",
        parts: [
          {
            type: "tool",
            tool: "view_image",
            callId: "image-1",
            status: "completed",
            state: {
              input: { path: "/tmp/long question.png" },
              output: [{ type: "image", source: "/tmp/long question.png", src: image, mimeType: "image/png" }],
            },
          },
        ],
      },
      {
        id: "answer",
        role: "assistant",
        parts: [{ type: "text", text: "![Long question opened](/tmp/long%20question.png)" }],
      },
    ],
    chatInputPlaceholder: "Message the agent...",
    emptyStateTitle: "",
    emptyStateDescription: "",
  },
};

export const WorkspaceImage: Story = {
  args: {
    ...CapturedLocalImage.args,
    messages: [
      {
        id: "answer",
        role: "assistant",
        parts: [{ type: "text", text: "![Workspace preview][preview]\n\n[preview]: screenshots/preview.png" }],
      },
    ],
    linkHandler: {
      resolveHref: ({ source }) => `workspace://${source}`,
      open: () => {},
      async resolveImageSource(source) {
        if (!this.resolveHref({ source, origin: "markdown" })) return null;
        return image;
      },
    },
  },
};

export const RepeatedImageCapture: Story = {
  args: {
    ...CapturedLocalImage.args,
    messages: [
      {
        id: "versions",
        role: "assistant",
        parts: [
          {
            type: "tool",
            tool: "view_image",
            status: "completed",
            state: {
              output: [{ type: "image", source: "/tmp/preview.png", src: image }],
            },
          },
          { type: "text", text: "![First capture](/tmp/preview.png)" },
          {
            type: "tool",
            tool: "view_image",
            status: "completed",
            state: {
              output: [{ type: "image", source: "/tmp/preview.png", src: secondImage }],
            },
          },
          { type: "text", text: "![Second capture](/tmp/preview.png)" },
        ],
      },
    ],
  },
};

async function resolveWorkspaceImage(this: ChatLinkHandler, source: string) {
  return this.resolveHref({ source, origin: "markdown" })?.startsWith("workspace://second/") ? secondImage : image;
}
const firstHandler: ChatLinkHandler = {
  resolveHref: ({ source }) => `workspace://first/${source}`,
  resolveImageSource: resolveWorkspaceImage,
  open: () => {},
};
const secondHandler: ChatLinkHandler = {
  ...firstHandler,
  resolveHref: ({ source }) => `workspace://second/${source}`,
};

function WorkspaceSwitchPreview() {
  const [handler, setHandler] = useState(firstHandler);
  return (
    <>
      <Button onClick={() => setHandler(secondHandler)}>Switch workspace</Button>
      <ChatPanel {...WorkspaceImage.args!} linkHandler={handler} />
    </>
  );
}

export const WorkspaceSwitch: Story = { render: () => <WorkspaceSwitchPreview /> };
