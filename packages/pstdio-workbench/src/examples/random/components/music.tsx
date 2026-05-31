import { Badge, Box, Button, Center, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { WorkbenchIcon, type WorkbenchWidgetRenderInput } from "../../../react";
import { itemResource, musicWidgetIds, randomWorkbenchModes, type WorkbenchModeItem } from "../mock-data/data";

const musicMode = randomWorkbenchModes.music;

const findActiveItem = (input: WorkbenchWidgetRenderInput) => {
  const placement = input.workbench.layout.getLayout().areas.main.widgets[0];
  const itemId =
    typeof placement?.resource?.metadata?.itemId === "string" ? placement.resource.metadata.itemId : undefined;
  return (
    musicMode.items.find((item) => item.id === itemId) ??
    musicMode.items.find((item) => item.id === musicMode.defaultItemId) ??
    musicMode.items[0]
  );
};

const playItem = (input: WorkbenchWidgetRenderInput, item: WorkbenchModeItem) => {
  input.workbench.layout.openWidget(musicWidgetIds.player, {
    resource: itemResource(musicMode.id, item),
    title: item.title,
  });
  input.refresh();
};

export const MusicTopBar = (props: { input: WorkbenchWidgetRenderInput }) => {
  const item = findActiveItem(props.input);
  return (
    <HStack h="full" px="sm" gap="sm">
      <WorkbenchIcon name={musicMode.topIcon} size={18} />
      <HStack flex="1" minW="0" gap="xs">
        <Text textStyle="label/S/medium" color="fg" flexShrink={0}>
          {item.title}
        </Text>
        <Text textStyle="label/XS/regular" color="fg.muted" truncate>
          {item.subtitle}
        </Text>
      </HStack>
      <Badge colorPalette="purple" variant="subtle" size="sm">
        Now playing
      </Badge>
    </HStack>
  );
};

export const MusicPlayer = (props: { input: WorkbenchWidgetRenderInput }) => {
  const item = findActiveItem(props.input);
  return (
    <ScrollArea
      h="full"
      minH="0"
      w="full"
      contentProps={{ display: "flex", alignItems: "center", justifyContent: "center", p: "lg", textAlign: "center" }}
    >
      <Stack gap="md" align="center" justify="center" w="full" maxW="32rem" mx="auto">
        <Center
          aspectRatio={1}
          w="full"
          maxW="20rem"
          borderRadius="lg"
          bgGradient="to-br"
          gradientFrom="purple.300"
          gradientTo="purple.600"
          color="white"
          boxShadow="lg"
        >
          <WorkbenchIcon name="Disc3" size={96} />
        </Center>
        <Stack gap="2xs" align="center">
          <Text textStyle="heading/L" color="fg" textAlign="center">
            {item.title}
          </Text>
          <Text textStyle="label/S/regular" color="fg.muted" textAlign="center">
            {item.subtitle}
          </Text>
        </Stack>
        {item.sections.map((section) => (
          <Stack key={section.heading} gap="2xs" align="center" w="full" maxW="24rem">
            <Text textStyle="label/XS/medium" color="fg.muted">
              {section.heading}
            </Text>
            {section.lines.map((line) => (
              <Text key={line} textStyle="paragraph/S/regular" color="fg" textAlign="center">
                {line}
              </Text>
            ))}
          </Stack>
        ))}
      </Stack>
    </ScrollArea>
  );
};

export const MusicQueue = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const activeItem = findActiveItem(input);

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
      <Stack gap="sm" w="full">
        <Text textStyle="label/S/medium" color="fg">
          Up next
        </Text>
        <Stack gap="2xs">
          {musicMode.items.map((item) => {
            const selected = item.id === activeItem.id;
            return (
              <Box
                key={item.id}
                as="button"
                onClick={() => playItem(input, item)}
                textAlign="left"
                borderRadius="md"
                bg={selected ? "purple.subtle" : "transparent"}
                _hover={{ bg: selected ? "purple.subtle" : "bg.muted" }}
                px="sm"
                py="xs"
              >
                <HStack gap="sm" minW="0">
                  <WorkbenchIcon
                    name={selected ? "Volume2" : "Play"}
                    size={14}
                    color={selected ? "purple.fg" : "fg.muted"}
                  />
                  <Stack gap="0" minW="0">
                    <Text textStyle="paragraph/S/medium" color="fg" truncate>
                      {item.title}
                    </Text>
                    <Text textStyle="label/XS/regular" color="fg.muted" truncate>
                      {item.subtitle}
                    </Text>
                  </Stack>
                </HStack>
              </Box>
            );
          })}
        </Stack>
        <Box pt="sm" borderTopWidth="1px" borderColor="border.muted">
          <Text textStyle="label/XS/medium" color="fg.muted" mb="xs">
            From queue
          </Text>
          <Stack gap="2xs">
            {musicMode.related.map((entry) => (
              <HStack key={entry.label} gap="xs">
                <WorkbenchIcon name={entry.icon} size={12} color="fg.muted" />
                <Text textStyle="paragraph/XS/regular" color="fg.muted" truncate>
                  {entry.label}
                </Text>
              </HStack>
            ))}
          </Stack>
        </Box>
      </Stack>
    </ScrollArea>
  );
};

export const MusicControls = () => (
  <HStack h="full" px="md" gap="md" justify="center" bg="bg.subtle">
    <IconButton aria-label="Previous" variant="ghost" size="sm">
      <WorkbenchIcon name="SkipBack" size={18} />
    </IconButton>
    <IconButton aria-label="Play" variant="solid" colorPalette="purple" size="md" borderRadius="full">
      <WorkbenchIcon name="Play" size={20} />
    </IconButton>
    <IconButton aria-label="Next" variant="ghost" size="sm">
      <WorkbenchIcon name="SkipForward" size={18} />
    </IconButton>
    <Box flex="1" maxW="20rem" mx="md">
      <Box h="2px" bg="bg.muted" borderRadius="full" position="relative">
        <Box position="absolute" left="0" top="0" h="full" w="33%" bg="purple.fg" borderRadius="full" />
      </Box>
    </Box>
    <HStack gap="xs">
      <Button size="xs" variant="ghost">
        <WorkbenchIcon name="ListMusic" size={14} />
        Queue
      </Button>
      <Button size="xs" variant="ghost">
        <WorkbenchIcon name="Heart" size={14} />
        Like
      </Button>
    </HStack>
  </HStack>
);

export const MusicStatus = () => (
  <HStack h="full" px="sm" gap="md">
    <WorkbenchIcon name={musicMode.statusIcon} size={12} color="fg.muted" />
    <Text textStyle="label/XS/medium" color="fg">
      {musicMode.statusText}
    </Text>
  </HStack>
);
