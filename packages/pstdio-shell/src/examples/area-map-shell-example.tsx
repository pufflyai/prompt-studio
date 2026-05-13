import { Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { createShellCore, type ShellArea, type ShellCore, shellAreas } from "../core";
import { ShellWorkbench } from "../react";

const areaMapRendererId = "area-map.placeholder";
const areaResourceKind = "shell-area";

const areaLabels = {
  top: "Top header area",
  activityBar: "Activity bar",
  "left-header": "Left side header",
  left: "Left side panel",
  "main-header": "Main header area",
  "main-left-header": "Main left header",
  "main-left": "Main left panel",
  main: "Main editor area",
  "main-right-header": "Main right header",
  "main-right": "Main right panel",
  "main-bottom-header": "Main bottom header",
  "main-bottom": "Main bottom panel",
  status: "Status bar",
  overlay: "Overlay layer",
  floating: "Floating panel",
} as const satisfies Record<ShellArea, string>;

interface AreaResourceInput {
  id?: string;
  uri?: string;
  label?: string;
}

const createAreaResource = (area: ShellArea, input: AreaResourceInput = {}) => ({
  kind: areaResourceKind,
  id: input.id ?? area,
  uri: input.uri ?? `pstdio://area-map/${area}`,
  label: input.label ?? areaLabels[area],
  icon: "SquareDashed",
  metadata: { area },
});

const areaWidgetId = (area: ShellArea) => `area-map.${area}`;

interface BottomExtraWidget {
  id: string;
  label: string;
}

const bottomExtraWidgets: BottomExtraWidget[] = [
  { id: "main-bottom-output", label: "Output" },
  { id: "main-bottom-problems", label: "Problems" },
  { id: "main-bottom-terminal", label: "Terminal" },
  { id: "main-bottom-tests", label: "Tests" },
];

const isShellArea = (value: unknown): value is ShellArea =>
  typeof value === "string" && (shellAreas as readonly string[]).includes(value);

const resolvePlacementArea = (value: unknown, fallback: string) => {
  if (isShellArea(value)) return value;
  if (isShellArea(fallback)) return fallback;
  return "main";
};

const AreaPlaceholderContent = (props: { area: ShellArea; uri: string; name: string }) => {
  const { area, name, uri } = props;

  return (
    <>
      <Text textStyle="label/M/medium" color="fg" truncate>
        {name}
      </Text>
      <Text as="code" textStyle="label/XS/regular" color="fg.muted" overflowWrap="anywhere">
        {uri}
      </Text>
      <Text as="code" textStyle="label/XS/regular" color="fg.subtle">
        {area}
      </Text>
    </>
  );
};

const AreaPlaceholder = (props: { area: ShellArea; uri: string; name: string }) => {
  const { area, name, uri } = props;

  if (area === "overlay") {
    return (
      <Flex h="full" w="full" alignItems="center" justifyContent="center" p="xl" pointerEvents="none">
        <Stack
          bg="bg"
          borderWidth="1px"
          borderColor="border.emphasized"
          boxShadow="lg"
          gap="2xs"
          maxW="24rem"
          minH="9rem"
          p="md"
          pointerEvents="auto"
          w="full"
        >
          <AreaPlaceholderContent area={area} name={name} uri={uri} />
        </Stack>
      </Flex>
    );
  }

  if (area === "status") {
    return (
      <HStack h="full" minW="0" overflow="hidden" px="xs" gap="xs">
        <Text textStyle="label/XS/medium" color="fg" flexShrink={0}>
          {name}
        </Text>
        <Text as="code" textStyle="label/XS/regular" color="fg.muted" truncate>
          {uri}
        </Text>
      </HStack>
    );
  }

  const isHeaderArea =
    area === "top" ||
    area === "main-header" ||
    area === "left-header" ||
    area === "main-left-header" ||
    area === "main-right-header" ||
    area === "main-bottom-header";

  if (isHeaderArea) {
    return (
      <HStack h="full" minW="0" overflow="hidden" gap="xs" px="xs">
        <Text textStyle="label/S/medium" color="fg" flexShrink={0}>
          {name}
        </Text>
        <Text as="code" textStyle="label/XS/regular" color="fg.muted" truncate>
          {uri}
        </Text>
      </HStack>
    );
  }

  if (area === "activityBar") {
    return (
      <Flex h="full" w="full" alignItems="center" justifyContent="center" overflow="hidden" p="xs">
        <Stack alignItems="center" gap="xs" maxH="full" minW="0" overflow="hidden" css={{ writingMode: "vertical-rl" }}>
          <Text textStyle="label/XS/medium" color="fg" truncate>
            {name}
          </Text>
          <Text as="code" textStyle="label/XS/regular" color="fg.muted" truncate>
            {uri}
          </Text>
        </Stack>
      </Flex>
    );
  }

  return (
    <Stack h="full" minH="0" minW="0" justifyContent="center" gap="2xs" overflow="hidden" p="md">
      <AreaPlaceholderContent area={area} name={name} uri={uri} />
    </Stack>
  );
};

const registerAreaMapRenderers = (shell: ShellCore) => {
  shell.renderers.registerRenderer({
    id: areaMapRendererId,
    render: ({ placement }) => {
      const area = resolvePlacementArea(
        placement.resource?.metadata?.area,
        placement.resource?.id ?? placement.contributionId,
      );

      return (
        <AreaPlaceholder
          area={area}
          name={placement.resource?.label ?? placement.title ?? placement.contributionId}
          uri={placement.resource?.uri ?? "pstdio://area-map/unknown"}
        />
      );
    },
  });
};

const createAreaMapShellExample = () => {
  const shell = createShellCore();
  shell.resources.registerKind({ kind: areaResourceKind, label: "Shell area", icon: "SquareDashed" });

  for (const area of shellAreas) {
    shell.layout.registerWidget({
      id: areaWidgetId(area),
      title: areaLabels[area],
      area,
      singleton: true,
      renderer: "react",
      rendererId: areaMapRendererId,
    });

    shell.layout.openWidget(areaWidgetId(area), { resource: createAreaResource(area) });
  }

  for (const widget of bottomExtraWidgets) {
    shell.layout.registerWidget({
      id: `area-map.${widget.id}`,
      title: widget.label,
      area: "main-bottom",
      singleton: true,
      renderer: "react",
      rendererId: areaMapRendererId,
    });
    shell.layout.openWidget(`area-map.${widget.id}`, {
      resource: createAreaResource("main-bottom", {
        id: widget.id,
        uri: `pstdio://area-map/main-bottom/${widget.id}`,
        label: widget.label,
      }),
    });
  }

  registerAreaMapRenderers(shell);

  return { shell };
};

export const AreaMapShellExample = () => {
  const [example] = useState(createAreaMapShellExample);

  return <ShellWorkbench shell={example.shell} initialSessionPanelMode="attached" />;
};
