import { expect, test } from "bun:test";
import { composeNativeChatLinks } from "./native-chat-links";

test("native workspace links preserve provider callbacks and use host only as fallback", async () => {
  const opened: string[] = [];
  const links = composeNativeChatLinks(
    {
      resolveHref: () => null,
      resolveIcon: async () => null,
      resolveResource: async ({ source }) => (source.startsWith("custom:") ? { href: source, label: "Owned" } : null),
      resolveImageSource: async (source) => (source.startsWith("custom:") ? "data:image/png;base64,custom" : null),
      open: ({ source }) => {
        opened.push(`provider:${source}`);
      },
    },
    {
      resolveHref: () => "/workspace",
      resolveIcon: async () => "data:image/png;base64,icon",
      resolveResource: async () => ({ href: "/workspace" }),
      resolveImageSource: async () => "data:image/png;base64,workspace",
      open: ({ source }) => {
        opened.push(`host:${source}`);
      },
    },
  );
  expect(await links.resolveIcon?.("https://example.test")).toBe("data:image/png;base64,icon");
  const custom = { source: "custom:resource", origin: "markdown" as const };
  const workspace = { source: "./image.png", origin: "markdown" as const };
  expect(await links.resolveResource?.(custom)).toEqual({ href: custom.source, label: "Owned" });
  expect(await links.resolveImageSource?.(custom.source)).toBe("data:image/png;base64,custom");
  expect(await links.resolveImageSource?.(workspace.source)).toBe("data:image/png;base64,workspace");
  await links.open(custom);
  await links.open(workspace);
  expect(opened).toEqual(["provider:custom:resource", "host:./image.png"]);
});
