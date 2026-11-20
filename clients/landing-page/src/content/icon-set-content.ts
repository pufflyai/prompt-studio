import { createGlyphIcon } from "@pstdio/ui";

export const EXAMPLE_ICONS = [
  { name: "cloud-add", codepoint: "E800" },
  { name: "history", codepoint: "E802" },
  { name: "add-circle", codepoint: "E808" },
  { name: "metrics", codepoint: "E80D" },
  { name: "folder", codepoint: "E880" },
  { name: "global", codepoint: "E885" },
  { name: "notification", codepoint: "E88E" },
  { name: "grid-4", codepoint: "E894" },
  { name: "code", codepoint: "E8D7" },
  { name: "component", codepoint: "E8E2" },
  { name: "magicpen", codepoint: "E9E4" },
  { name: "star", codepoint: "EB07" },
].map((item) => ({ ...item, id: item.name, icon: createGlyphIcon(item.name) }));

export type ExampleIcon = (typeof EXAMPLE_ICONS)[number];
