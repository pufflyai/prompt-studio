import { Button } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Palette, type PaletteEntry } from "./palette";

const entry = (id: string): PaletteEntry => ({ id, label: id, onActivate: () => undefined });

const LiveEntriesPalette = () => {
  const [loaded, setLoaded] = useState(false);
  const entries = loaded
    ? [entry("pstdio-light"), entry("monokai"), entry("pstdio-dark")]
    : [entry("pstdio-light"), entry("pstdio-dark")];
  return (
    <Palette
      open
      entries={entries}
      initialActiveIndex={loaded ? 2 : 1}
      placeholder="Choose a theme"
      footerEnd={<Button onClick={() => setLoaded(!loaded)}>Toggle contributed themes</Button>}
      onClose={() => undefined}
    />
  );
};

const meta: Meta<typeof LiveEntriesPalette> = {
  title: "Components/Overlays/Palette/Live entries",
  component: LiveEntriesPalette,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof LiveEntriesPalette>;
export const PreservesHighlight: Story = { render: () => <LiveEntriesPalette /> };
