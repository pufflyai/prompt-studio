import { Button, IconButton, Popover, Portal, Text, Wrap } from "@chakra-ui/react";
import { ScrollArea, Tooltip } from "@pstdio/ui";
import { useCollectionViewStore } from "@pstdio/ui/collection-view";
import { type AttributeDescriptor, buildDisplayPropertyOptions } from "@pstdio/ui/kanban-renderer";
import { Settings2 } from "lucide-react";
import { timelineInitialState } from "./timeline-query";

interface TimelineDisplayMenuProps {
  storageKey: string;
  attributes: AttributeDescriptor[];
}

export function TimelineDisplayMenu(props: TimelineDisplayMenuProps) {
  const { storageKey, attributes } = props;
  const { settings, setSettings } = useCollectionViewStore(storageKey, timelineInitialState, (state) => state);
  const properties = settings.displayProperties;
  return (
    <Popover.Root lazyMount unmountOnExit positioning={{ placement: "bottom-end" }}>
      <Tooltip content="Display">
        <Popover.Trigger asChild>
          <IconButton aria-label="Display settings" variant="ghost" size="2xs">
            <Settings2 />
          </IconButton>
        </Popover.Trigger>
      </Tooltip>
      <Portal>
        <Popover.Positioner>
          <Popover.Content aria-label="Display settings">
            <Popover.Body>
              <Text textStyle="label/XS/medium" color="fg.muted" textTransform="uppercase" py="xs">
                Properties
              </Text>
              <ScrollArea maxH="filter-picker-height">
                <Wrap gap="2xs">
                  {buildDisplayPropertyOptions(attributes).map(({ value, label }) => (
                    <Button
                      key={value}
                      size="2xs"
                      variant="ghost"
                      aria-pressed={properties.includes(value)}
                      onClick={() =>
                        setSettings({
                          displayProperties: properties.includes(value)
                            ? properties.filter((property) => property !== value)
                            : [...properties, value],
                        })
                      }
                    >
                      {label}
                    </Button>
                  ))}
                </Wrap>
              </ScrollArea>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
