import { Button, Drawer, HStack, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import { DeleteConfirmationModal, SearchableMenu, Tooltip } from "@pstdio/ui";
import { useState } from "react";
import { GallerySection } from "./gallery-section";

export function Overlays() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [choice, setChoice] = useState("None");
  return (
    <GallerySection title="Menus, tooltips and overlays">
      <Text textStyle="label/S/regular" color="fg.muted">
        Open controls to compare surfaces, focus and portal colors.
      </Text>
      <Stack align="start">
        <SearchableMenu
          trigger={<Button>Choose resource</Button>}
          searchPlaceholder="Find a resource"
          emptyState="No matching resources"
          items={[
            { id: "one", label: "First resource", onSelect: () => setChoice("First resource") },
            { id: "two", label: "Selected resource", isSelected: true, onSelect: () => setChoice("Selected resource") },
            { id: "disabled", label: "Disabled resource", isDisabled: true },
          ]}
        />
        <Text textStyle="label/S/regular">Selected: {choice}</Text>
        <Tooltip content="Helpful information">
          <Button variant="ghost">Hover for tooltip</Button>
        </Tooltip>
        <Popover.Root>
          <Popover.Trigger asChild>
            <Button>Open popover</Button>
          </Popover.Trigger>
          <Portal>
            <Popover.Positioner>
              <Popover.Content>
                <Popover.Body>
                  <Text>Popover surface and border</Text>
                </Popover.Body>
              </Popover.Content>
            </Popover.Positioner>
          </Portal>
        </Popover.Root>
        <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
        <DeleteConfirmationModal
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onDelete={() => setDialogOpen(false)}
          headline="Remove resource?"
          notificationText="Review the dialog surface, border, and actions."
          buttonText="Remove"
        />
        <Drawer.Root size="xs">
          <Drawer.Trigger asChild>
            <Button>Open drawer</Button>
          </Drawer.Trigger>
          <Portal>
            <Drawer.Backdrop />
            <Drawer.Positioner>
              <Drawer.Content>
                <Drawer.Header>
                  <Drawer.Title>Drawer</Drawer.Title>
                </Drawer.Header>
                <Drawer.Body>Panel content</Drawer.Body>
                <Drawer.Footer>
                  <Drawer.CloseTrigger asChild>
                    <Button>Close drawer</Button>
                  </Drawer.CloseTrigger>
                </Drawer.Footer>
              </Drawer.Content>
            </Drawer.Positioner>
          </Portal>
        </Drawer.Root>
      </Stack>
      <HStack>
        <Button variant="primary">Primary action</Button>
        <Button>Cancel</Button>
      </HStack>
    </GallerySection>
  );
}
