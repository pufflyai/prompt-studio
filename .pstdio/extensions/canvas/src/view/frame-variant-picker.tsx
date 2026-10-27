import { Button, Menu, Portal } from "@chakra-ui/react";
import type { CanvasItem, CanvasVariant } from "../canvases/definitions";

interface Props {
  item: CanvasItem;
  selected: CanvasVariant;
  onSelect: (id: string) => void;
}
export const FrameVariantPicker = (props: Props) => {
  const { item, selected, onSelect } = props;
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button size="xs" variant="ghost-static" aria-label={`Variant for ${item.name}: ${selected.name}`}>
          Variant: {selected.name}
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content maxH="80vh" overflowY="auto">
            {item.variants?.map((variant) => (
              <Menu.Item key={variant.id} value={variant.id} onClick={() => onSelect(variant.id)}>
                {variant.id === selected.id ? "✓ " : ""}
                {variant.name}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
