import { Button, IconButton, Popover, Portal, Text, Wrap } from "@chakra-ui/react";
import { ScrollArea, Tooltip } from "@pstdio/ui";
import { useCollectionViewStore } from "@pstdio/ui/collection-view";
import { type AttributeDescriptor, buildDisplayPropertyOptions } from "@pstdio/ui/kanban-renderer";
import { Settings2 } from "lucide-react";
import { useRef } from "react";
import { useTimelinePresentation } from "./timeline-presentation";
import { timelineInitialState } from "./timeline-query";

interface TimelineDisplayMenuProps {
  storageKey: string;
  attributes: AttributeDescriptor[];
}

export function TimelineDisplayMenu(props: TimelineDisplayMenuProps) {
  const { storageKey, attributes } = props;
  const { settings, setSettings } = useCollectionViewStore(storageKey, timelineInitialState, (state) => state);
  const presentation = useTimelinePresentation();
  const properties = settings.displayProperties;
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <Popover.Root
      lazyMount
      unmountOnExit
      positioning={{
        placement: "bottom-end",
        strategy: "fixed",
        offset: { mainAxis: 8 },
        getAnchorElement: () => triggerRef.current,
      }}
    >
      <Tooltip content="Display">
        <Popover.Trigger asChild>
          <IconButton ref={triggerRef} aria-label="Display settings" variant="ghost" size="2xs">
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
              <Text textStyle="label/XS/medium" color="fg.muted" textTransform="uppercase" py="xs">
                Milestones
              </Text>
              <Wrap gap="2xs">
                {(
                  [
                    ["showPassedMilestones", "Show passed milestones"],
                    ["showCompletedMilestones", "Show completed milestones"],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    size="2xs"
                    variant="ghost"
                    aria-pressed={presentation.value[key] !== false}
                    onClick={() => presentation.update({ [key]: presentation.value[key] === false })}
                  >
                    {label}
                  </Button>
                ))}
              </Wrap>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
