import { Button, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
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
} satisfies Meta<typeof RichMessage>;
export default meta;
type Story = StoryObj<typeof meta>;

const siteIcon = (link: HTMLElement) =>
  waitFor(() => {
    const icon = link.querySelector("img");
    expect(icon?.getAttribute("src")).toMatch(/^data:image\/svg\+xml;base64,/);
    return icon!;
  });

export const SiteIcons: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const links = {
      GitHub: "https://github.com/pufflyai/prompt-studio",
      "https://docs.example.com/guide": "https://docs.example.com/guide",
      "https://angle.example.com/a": "https://angle.example.com/a",
      "www.example.org": "http://www.example.org",
      page: "https://refs.example.com/page",
      "Table docs": "https://table.example.com/docs",
    };
    for (const [name, href] of Object.entries(links)) {
      const link = await canvas.findByRole("link", { name, exact: true });
      await expect(link).toHaveAttribute("href", href);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
      await expect(await siteIcon(link)).toHaveAttribute("alt", "");
      await expect(link.querySelector('[data-scope="tooltip"]')).toBeNull();
    }

    for (const name of ["https://missing.example.com", "https://broken.example.com"]) {
      const link = await canvas.findByRole("link", { name, exact: true });
      await waitFor(() => expect(link.querySelector("svg.lucide-globe")).not.toBeNull());
      await expect(link.querySelector("img")).toBeNull();
    }

    const badge = canvas.getByRole("link", { name: "Build", exact: true });
    await expect(badge).toHaveAttribute("href", "https://ci.example.com");
    await expect(badge.querySelector('img[alt="Build"]')).not.toBeNull();

    const email = canvas.getByRole("link", { name: "Email", exact: true });
    await expect(email).toHaveAttribute("href", "mailto:team@example.com");
    await expect(email.querySelector("img, svg")).toBeNull();

    const message = canvasElement.querySelector('[data-rich-message="true"] [contenteditable]')!;
    let html = "";
    window.addEventListener("copy", (event) => (html = event.clipboardData?.getData("text/html") ?? ""), {
      once: true,
    });
    window.getSelection()!.selectAllChildren(message);
    document.execCommand("copy");
    window.getSelection()!.removeAllRanges();
    await expect(html).toMatch(/<a href="https:\/\/github\.com\/pufflyai\/prompt-studio"[^>]*>GitHub<\/a>/);
  },
};

export const HostWithoutIcons: Story = {
  args: { linkHandler: { resolveHref: () => null, open: () => {} } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = await canvas.findByRole("link", { name: "GitHub", exact: true });
    await expect(link).toHaveAttribute("href", "https://github.com/pufflyai/prompt-studio");
    await expect(link.querySelector("img, svg")).toBeNull();
    const autolink = canvas.getByRole("link", { name: "https://docs.example.com/guide", exact: true });
    await expect(autolink.querySelector("img, svg")).toBeNull();
  },
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
  render: () => <StreamingMessage />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const partial = await canvas.findByRole("link", { name: "https://docs.exa", exact: true });
    await expect(partial.querySelector("svg.lucide-globe")).not.toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Next chunk" }));
    const link = await canvas.findByRole("link", { name: "https://docs.example.com/guide", exact: true });
    await expect(link.querySelector("svg.lucide-globe")).not.toBeNull();
    await expect(canvas.getByTestId("asked-icons")).toHaveTextContent(/^$/);
    await userEvent.click(canvas.getByRole("button", { name: "Finish" }));
    await siteIcon(canvas.getByRole("link", { name: "https://docs.example.com/guide", exact: true }));
    await expect(canvas.getByTestId("asked-icons")).toHaveTextContent(/^https:\/\/docs\.example\.com\/guide$/);
  },
};
