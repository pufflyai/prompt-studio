import { Button } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
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
const meta: CanvasMeta<typeof LiveEntriesPalette> = {
  title: "Components/Overlays/Palette/Live entries",
  component: LiveEntriesPalette,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = CanvasVariant<typeof LiveEntriesPalette>;
export const PreservesHighlight: Story = {
  id: "components-overlays-palette-live-entries--preserves-highlight",
  render: () => <LiveEntriesPalette />,
};
