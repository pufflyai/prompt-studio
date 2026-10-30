import { Menu, Portal } from "@chakra-ui/react";
import { useSyncExternalStore } from "react";
import { Button } from "../components/themed-primitives";
import type { CanvasRuntime } from "../controller/runtime";
import { frameThemes } from "../frame-themes";

export const FrameThemePicker = (props: { id: string; name: string; runtime: CanvasRuntime }) => {
  const { id, name, runtime } = props;
  const selected = useSyncExternalStore(runtime.subscribe, () => runtime.get().themes[id] ?? "app");
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
