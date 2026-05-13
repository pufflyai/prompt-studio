import { Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { createShellCore, type ShellArea, shellAreas } from "../core";
import { type ShellRendererRegistration, ShellWorkbench } from "../react";

const areaMapRendererId = "area-map.placeholder";
const areaResourceKind = "shell-area";

const areaLabels = {
  top: "Top header area",
  activityBar: "Activity bar",
  left: "Left side panel",
  "main-header": "Main header area",
  "main-left": "Main left panel",
  main: "Main editor area",
  "main-right": "Main right panel",
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
const bottomOutputWidgetId = "area-map.bottom.output";

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

  if (area === "top" || area === "main-header") {
    return (
      <HStack h="full" minW="0" overflow="hidden" gap="xs">
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

const createAreaMapRenderers = (): ShellRendererRegistration[] => [
  {
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
  },
];

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

  shell.layout.registerWidget({
    id: bottomOutputWidgetId,
    title: "Main bottom output",
    area: "main-bottom",
    singleton: true,
    renderer: "react",
    rendererId: areaMapRendererId,
  });
  shell.layout.openWidget(bottomOutputWidgetId, {
    resource: createAreaResource("main-bottom", {
      id: "main-bottom-output",
      uri: "pstdio://area-map/main-bottom/output",
      label: "Main bottom output",
    }),
  });

  return { shell, renderers: createAreaMapRenderers() };
};

export const AreaMapShellExample = () => {
  const [example] = useState(createAreaMapShellExample);

  return <ShellWorkbench shell={example.shell} renderers={example.renderers} initialSessionPanelMode="attached" />;
};
