import { Menu, Portal } from "@chakra-ui/react";
import { useSyncExternalStore } from "react";
import type { CanvasItem } from "../canvases/definitions";
import { Button } from "../components/themed-primitives";
import type { CanvasRuntime } from "../controller/runtime";
import { frameThemes, resolveFrameTheme } from "../frame-themes";

export const FrameThemePicker = (props: { item: CanvasItem; runtime: CanvasRuntime }) => {
  const { item, runtime } = props;
  const { id, name } = item;
  const selected = useSyncExternalStore(runtime.subscribe, () =>
    resolveFrameTheme(runtime.get().themes[id], item.preview?.kind === "story" ? item.preview.defaultTheme : undefined),
  );
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button size="xs" variant="ghost-static" aria-label={`Theme for ${name}`}>
          Theme
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            {frameThemes.map((theme) => (
              <Menu.Item key={theme.id} value={theme.id} onClick={() => runtime.setTheme(id, theme.id)}>
                {theme.id === selected ? "✓ " : ""}
                {theme.title}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
