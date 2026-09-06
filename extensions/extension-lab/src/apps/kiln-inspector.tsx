import { Badge, Box, Button, HStack, IconButton, Input, Stack, Text } from "@chakra-ui/react";
import { useExampleStore, usePageResource } from "../example-store";
import { ExampleIcon } from "../icon";
import type { ExampleViewInput } from "../view-context";
import { type KilnObject, type KilnVector, kilnObjects, kilnPage, kilnResource } from "./kiln-data";
import { kilnStore, toggleKilnVisibility, updateKilnVector } from "./kiln-state";

const axisColors = { X: "red.fg", Y: "green.fg", Z: "blue.fg" } as const;

const VectorEditor = (props: {
  label: string;
  object: KilnObject;
  property: "position" | "rotation" | "scale";
  value: KilnVector;
}) => {
  const { label, object, property, value } = props;
  return (
    <Stack gap="xs">
      <Text textStyle="paragraph/XS/semibold">{label}</Text>
      <HStack gap="xs">
        {(["X", "Y", "Z"] as const).map((axis, index) => (
          <HStack key={axis} flex="1" minW="0" gap="2xs">
            <Text color={axisColors[axis]} textStyle="paragraph/XS/semibold">
              {axis}
            </Text>
            <Input
              aria-label={`${object.name} ${label.toLowerCase()} ${axis}`}
              type="number"
              size="xs"
              minW="0"
              value={value[index]}
              step={property === "rotation" ? 1 : 0.1}
              onChange={(event) => updateKilnVector(object.id, property, index, Number(event.target.value))}
            />
          </HStack>
        ))}
      </HStack>
    </Stack>
  );
};

const SceneOutliner = (props: { input: ExampleViewInput; selectedId: string }) => {
  const { input, selectedId } = props;
  const state = useExampleStore(kilnStore);
  return (
    <Stack minH="0" gap="0">
      <HStack px="sm" py="xs" justify="space-between" borderBottomWidth="1px" borderColor="border.subtle">
        <HStack gap="xs">
          <ExampleIcon name="ListTree" />
          <Text textStyle="label/XS">SCENE COLLECTION</Text>
        </HStack>
      </HStack>
      <Stack p="xs" gap="2xs" overflowY="auto">
        <HStack ps="xs" color="fg.muted">
          <ExampleIcon name="ChevronDown" size={12} />
          <ExampleIcon name="Boxes" size={13} />
          <Text textStyle="paragraph/XS/semibold">Collection</Text>
        </HStack>
        {kilnObjects.map((object) => {
          const visible = state.objectStates[object.id]?.visible ?? false;
          return (
            <HStack key={object.id} gap="2xs">
              <Button
                flex="1"
                minW="0"
                size="xs"
                ps="lg"
                variant={selectedId === object.id ? "subtle" : "ghost"}
                justifyContent="flex-start"
                aria-current={selectedId === object.id ? "true" : undefined}
                onClick={() =>
                  input.host.navigate({
                    kind: "page",
                    page: kilnPage,
                    resource: kilnResource(object),
                  })
                }
              >
                <ExampleIcon name={object.icon} />
                <Text truncate>{object.name}</Text>
              </Button>
              <IconButton
                aria-label={`${visible ? "Hide" : "Show"} ${object.name}`}
                aria-pressed={!visible}
                size="2xs"
                variant="ghost"
                onClick={() => toggleKilnVisibility(object.id)}
              >
                <ExampleIcon name={visible ? "Eye" : "EyeOff"} />
              </IconButton>
            </HStack>
          );
        })}
      </Stack>
    </Stack>
  );
};

export const KilnInspector = (props: { input: ExampleViewInput }) => {
  const { input } = props;
  const state = useExampleStore(kilnStore);
  const selectedId = usePageResource(input.host)?.id ?? kilnObjects[0].id;
  const object = kilnObjects.find((item) => item.id === selectedId) ?? kilnObjects[0];
  const objectState = state.objectStates[object.id];

  return (
    <Stack h="full" minH="0" gap="0" bg="bg.panel">
      <Box flexShrink={0} maxH="50%" overflowY="auto" borderBottomWidth="1px" borderColor="border">
        <SceneOutliner input={input} selectedId={selectedId} />
      </Box>
      <Stack flex="1" minH="0" overflowY="auto" gap="lg" p="md">
        <HStack justify="space-between">
          <HStack minW="0">
            <Box
              boxSize="8"
              borderRadius="md"
              bg={`${object.tint}.500`}
              display="grid"
              placeItems="center"
              flexShrink={0}
            >
              <ExampleIcon name={object.icon} color="white" />
            </Box>
            <Stack minW="0" gap="0">
              <Text truncate textStyle="paragraph/S/semibold">
                {object.name}
              </Text>
              <Text color="fg.muted" textStyle="paragraph/XS/regular">
                {object.kind}
              </Text>
            </Stack>
          </HStack>
          <Badge colorPalette={objectState.visible ? "green" : "gray"} variant="subtle">
            {objectState.visible ? "Visible" : "Hidden"}
          </Badge>
        </HStack>
        <Stack gap="md">
          <HStack justify="space-between">
            <HStack gap="xs">
              <ExampleIcon name="Move3d" />
              <Text textStyle="label/XS">BASE TRANSFORM</Text>
            </HStack>
            <IconButton
              aria-label="Reset transform"
              size="2xs"
              variant="ghost"
              onClick={() => {
                updateKilnVector(object.id, "position", 0, object.position[0]);
                updateKilnVector(object.id, "position", 1, object.position[1]);
                updateKilnVector(object.id, "position", 2, object.position[2]);
                updateKilnVector(object.id, "rotation", 0, object.rotation[0]);
                updateKilnVector(object.id, "rotation", 1, object.rotation[1]);
                updateKilnVector(object.id, "rotation", 2, object.rotation[2]);
                updateKilnVector(object.id, "scale", 0, object.scale[0]);
                updateKilnVector(object.id, "scale", 1, object.scale[1]);
                updateKilnVector(object.id, "scale", 2, object.scale[2]);
              }}
            >
              <ExampleIcon name="RotateCcw" />
            </IconButton>
          </HStack>
          <VectorEditor label="Position" object={object} property="position" value={objectState.position} />
          <VectorEditor label="Rotation" object={object} property="rotation" value={objectState.rotation} />
          <VectorEditor label="Scale" object={object} property="scale" value={objectState.scale} />
        </Stack>
        <Stack gap="sm" pt="md" borderTopWidth="1px" borderColor="border.subtle">
          <HStack gap="xs">
            <ExampleIcon name="Gem" />
            <Text textStyle="label/XS">MATERIAL</Text>
          </HStack>
          <HStack justify="space-between">
            <Text color="fg.muted" textStyle="paragraph/S/regular">
              Surface
            </Text>
            <HStack gap="xs">
              <Box boxSize="4" borderRadius="full" bg={`${object.tint}.500`} />
              <Text textStyle="paragraph/S/semibold">Kiln Clay</Text>
            </HStack>
          </HStack>
          <HStack justify="space-between">
            <Text color="fg.muted" textStyle="paragraph/S/regular">
              Roughness
            </Text>
            <Text textStyle="paragraph/S/semibold">0.42</Text>
          </HStack>
        </Stack>
      </Stack>
    </Stack>
  );
};
