import { Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import type { FileIconThemePreferenceOption } from "../../utils/apply-file-icon-theme-preference";
import { resolveFileIconElement } from "../../utils/resolve-file-icon-element";
import { TreeList } from "./tree-list";
import type { TreeListSection } from "./tree-list.types";

const meta: Meta<typeof TreeList> = {
  title: "Components/Data Display/File Icon Theme Tree",
  component: TreeList,
};

export default meta;
type Story = StoryObj<typeof TreeList>;

// A miniature Seti-like icon theme. Glyphs render once the contributed font is
// loaded; this story focuses on the resolution + color wiring and Lucide fallback.
const demoTheme: FileIconThemePreferenceOption = {
  id: "pstdio-base-themes.seti",
  title: "Seti (demo)",
  definitions: {
    _file: { fontCharacter: "\\E001", fontColor: "#9aa0a6" },
    _folder: { fontCharacter: "\\E002", fontColor: "#ddba78" },
    _typescript: { fontCharacter: "\\E099", fontColor: "#519aba" },
    _json: { fontCharacter: "\\E10A", fontColor: "#cbcb41" },
    _markdown: { fontCharacter: "\\E0A9", fontColor: "#519aba" },
  },
  fileExtensions: { ts: "_typescript", tsx: "_typescript", json: "_json", md: "_markdown" },
  fileNames: { "package.json": "_json" },
  defaults: { file: "_file", folder: "_folder" },
  fonts: [{ fontFamily: "pstdio-base-themes.seti-seti", src: [{ url: "data:font/woff;base64,", format: "woff" }] }],
};

const files = [
  { id: "src", label: "src", isDirectory: true },
  { id: "src/index.ts", label: "index.ts" },
  { id: "src/widget.tsx", label: "widget.tsx" },
  { id: "src/notes.md", label: "notes.md" },
  { id: "package.json", label: "package.json" },
  { id: "LICENSE", label: "LICENSE" },
];

const buildSections = (theme: FileIconThemePreferenceOption | undefined): TreeListSection[] => [
  {
    id: "files",
    nodes: files.map((file) => ({
      id: file.id,
      label: file.label,
      icon: resolveFileIconElement(file.label, { isDirectory: file.id === "src", theme }),
      isNavigable: true,
    })),
  },
];

const Demo = ({ theme }: { theme?: FileIconThemePreferenceOption }) => {
  const [activeNodeId, setActiveNodeId] = useState("src/index.ts");
  return (
    <Stack maxW="20rem" borderWidth="1px" p="xs" gap="xs">
      <TreeList
        sections={buildSections(theme)}
        activeNodeId={activeNodeId}
        rowVariant="tree"
        onNavigate={(event) => setActiveNodeId(event.nodeId)}
      />
    </Stack>
  );
};

export const WithSetiTheme: Story = {
  render: () => (
    <Stack gap="md">
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        Icons resolved from the contributed Seti theme (colored per file type).
      </Text>
      <Demo theme={demoTheme} />
    </Stack>
  ),
};

export const LucideFallback: Story = {
  render: () => (
    <Stack gap="md">
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        No active icon theme — falls back to built-in Lucide icons.
      </Text>
      <Demo />
    </Stack>
  ),
};
