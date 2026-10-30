import { Button, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { RichMessage } from "@/components/rich-text/rich-message/rich-message";
import type { ChatLinkHandler } from "../links/chat-link";

const MESSAGE = [
  "Read [GitHub](https://github.com/pufflyai/prompt-studio), https://docs.example.com/guide, <https://angle.example.com/a> and www.example.org.",
  "Open {{link('https://refs.example.com/page')}}, https://missing.example.com and https://broken.example.com.",
  "[Email](mailto:team@example.com) stays a plain link. [![Build](https://img.example.com/badge.png)](https://ci.example.com) keeps its image.",
  "",
  "| Link |",
  "| --- |",
  "| [Table docs](https://table.example.com/docs) |",
].join("\n");
const iconFor = (hue: number) =>
  `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="hsl(${hue} 70% 45%)"/></svg>`)}`;
// The demo host knows icons for some sites, none for missing.example.com, and returns broken bytes for broken.example.com.
const resolveIcon = async (href: string) => {
  const { hostname } = new URL(href);
  if (hostname === "missing.example.com") return null;
  if (hostname === "broken.example.com") return "data:image/png;base64,AAAA";
  return iconFor(hostname.length * 37);
};
const linkHandler: ChatLinkHandler = { resolveHref: () => null, resolveIcon, open: () => {} };
const meta = {
  title: "Chat/ChatPanel/Web links",
  component: RichMessage,
  parameters: { layout: "padded" },
  args: { defaultState: MESSAGE, linkHandler },
} satisfies CanvasMeta<typeof RichMessage>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const SiteIcons: Story = {
  id: "chat-chatpanel-web-links--site-icons",
};
export const HostWithoutIcons: Story = {
  id: "chat-chatpanel-web-links--host-without-icons",
  args: { linkHandler: { resolveHref: () => null, open: () => {} } },
};
// Bare links grow while a message streams, so their host names are not final until it ends.
const StreamingMessage = () => {
  const [text, setText] = useState("Read https://docs.exa");
  const [streaming, setStreaming] = useState(true);
  const [asked, setAsked] = useState<string[]>([]);
  return (
    <>
      <RichMessage
        defaultState={text}
        streaming={streaming}
        linkHandler={{
          resolveHref: () => null,
          resolveIcon: async (href) => {
            setAsked((previous) => [...previous, href]);
            return iconFor(200);
          },
          open: () => {},
        }}
      />
      <Button onClick={() => setText("Read https://docs.example.com/guide and more.")}>Next chunk</Button>
      <Button onClick={() => setStreaming(false)}>Finish</Button>
      <Text data-testid="asked-icons">{asked.join(" ")}</Text>
    </>
  );
};
export const StreamingLinks: Story = {
  id: "chat-chatpanel-web-links--streaming-links",
  render: () => <StreamingMessage />,
};
