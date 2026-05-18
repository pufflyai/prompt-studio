import { Badge, Box, Button, Code, Grid, HStack, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import type {
  PreferencePropertySchema,
  PreferenceSchemaContribution,
  PreferenceScopeRef,
  PreferenceValue,
  WorkbenchModuleContribution,
  WorkbenchWidgetRenderInput,
} from "../../core";
import { useWorkbenchStore, WorkbenchIcon } from "../../react";

const preferencesWidgetId = "preferences.schemas";
const preferencesRendererId = "preferences.schemas.renderer";
const densityPreferenceName = "preferences.example.editorDensity";
const defaultAreaPreferenceName = "preferences.example.defaultOpenArea";
const userScope = { scope: "user" } satisfies PreferenceScopeRef;
const workspaceScope = { scope: "workspace", scopeId: "storybook-workspace" } satisfies PreferenceScopeRef;
const preferenceNames = [densityPreferenceName, defaultAreaPreferenceName] as const;

const preferenceSchema = {
  properties: {
    [densityPreferenceName]: {
      type: "string",
      enum: ["comfortable", "compact"],
      default: "comfortable",
      scope: "user",
      description: "Controls the preferred editor density.",
    },
    [defaultAreaPreferenceName]: {
      type: "string",
      enum: ["main", "main-bottom", "main-right"],
      default: "main",
      scope: "workspace",
      description: "Controls where new resource views open for this workspace.",
    },
  },
} satisfies PreferenceSchemaContribution;

const densityOptions = [
  { value: "comfortable", label: "Comfortable", icon: "PanelTop" },
  { value: "compact", label: "Compact", icon: "Rows3" },
] as const;

const defaultAreaOptions = [
  { value: "main", label: "Main", icon: "PanelTop" },
  { value: "main-bottom", label: "Bottom", icon: "PanelBottom" },
  { value: "main-right", label: "Right", icon: "PanelRight" },
] as const;

const formatPreferenceValue = (value: PreferenceValue | undefined) => String(value ?? "unset");

const SchemaRow = (props: { name: string; schema: PreferencePropertySchema }) => {
  const { name, schema } = props;

  return (
    <Box borderWidth="1px" borderColor="border.muted" p="md">
      <HStack gap="sm" align="flex-start">
        <WorkbenchIcon name="Settings2" size={16} mt="2px" color="fg.muted" />
        <Stack gap="xs" minW="0" flex="1">
          <Code colorPalette="gray" w="fit-content" maxW="full" overflowWrap="anywhere">
            {name}
          </Code>
          <HStack gap="xs" wrap="wrap">
            <Badge colorPalette="blue">{schema.scope}</Badge>
            <Badge colorPalette="purple">{schema.type}</Badge>
            <Badge colorPalette="green">default {formatPreferenceValue(schema.default)}</Badge>
          </HStack>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {schema.description}
          </Text>
        </Stack>
      </HStack>
    </Box>
  );
};

const PreferenceOptionButton = (props: { icon: string; label: string; onClick: () => void; selected: boolean }) => {
  const { icon, label, onClick, selected } = props;

  return (
    <Button
      aria-pressed={selected}
      colorPalette={selected ? "blue" : "gray"}
      onClick={onClick}
      size="sm"
      variant={selected ? "solid" : "outline"}
    >
      <WorkbenchIcon name={icon} />
      {label}
    </Button>
  );
};

const PreferenceSchemasPanel = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const schemas = useWorkbenchStore(input.workbench.preferences.store, (state) => state.schemas);
  const [, setRevision] = useState(0);
  const density = input.workbench.preferences.getValue(densityPreferenceName, userScope);
  const defaultArea = input.workbench.preferences.getValue(defaultAreaPreferenceName, workspaceScope);

  const setPreference = (name: string, value: PreferenceValue, scope: PreferenceScopeRef) => {
    input.workbench.preferences.setValue(name, value, scope);
    setRevision((current) => current + 1);
  };

  return (
    <Stack gap="lg" h="full" minH="0" overflow="auto" p="lg">
      <Stack gap="xs">
        <Text textStyle="heading/M/semibold">Preference schemas</Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted" maxW="760px">
          Registered schemas define preference names, value types, defaults, and the scope where values are stored.
        </Text>
      </Stack>

      <Grid templateColumns={{ base: "1fr", lg: "repeat(2, minmax(0, 1fr))" }} gap="md">
        {preferenceNames.map((name) => (
          <SchemaRow key={name} name={name} schema={schemas[name] ?? preferenceSchema.properties[name]!} />
        ))}
      </Grid>

      <Grid templateColumns={{ base: "1fr", lg: "repeat(2, minmax(0, 1fr))" }} gap="md">
        <Box borderWidth="1px" borderColor="border.muted" p="md">
          <Stack gap="sm">
            <HStack justify="space-between" gap="sm" wrap="wrap">
              <Text textStyle="label/S/semibold">Editor density</Text>
              <Badge colorPalette="blue">user {formatPreferenceValue(density)}</Badge>
            </HStack>
            <HStack gap="xs" wrap="wrap">
              {densityOptions.map((option) => (
                <PreferenceOptionButton
                  key={option.value}
                  icon={option.icon}
                  label={option.label}
                  selected={density === option.value}
                  onClick={() => setPreference(densityPreferenceName, option.value, userScope)}
                />
              ))}
            </HStack>
          </Stack>
        </Box>

        <Box borderWidth="1px" borderColor="border.muted" p="md">
          <Stack gap="sm">
            <HStack justify="space-between" gap="sm" wrap="wrap">
              <Text textStyle="label/S/semibold">Default open area</Text>
              <Badge colorPalette="blue">workspace {formatPreferenceValue(defaultArea)}</Badge>
            </HStack>
            <HStack gap="xs" wrap="wrap">
              {defaultAreaOptions.map((option) => (
                <PreferenceOptionButton
                  key={option.value}
                  icon={option.icon}
                  label={option.label}
                  selected={defaultArea === option.value}
                  onClick={() => setPreference(defaultAreaPreferenceName, option.value, workspaceScope)}
                />
              ))}
            </HStack>
          </Stack>
        </Box>
      </Grid>
    </Stack>
  );
};

export const createPreferenceSchemasExampleModule = (): WorkbenchModuleContribution => ({
  id: "preferences-example",
  activate(ctx) {
    ctx.preferences.registerSchema(preferenceSchema);

    ctx.layout.registerWidget({
      id: preferencesWidgetId,
      title: "Preference schemas",
      area: "main",
      closable: false,
      rendererId: preferencesRendererId,
    });

    ctx.renderers.registerRenderer({
      id: preferencesRendererId,
      render: (input) => <PreferenceSchemasPanel input={input} />,
    });

    ctx.layout.openWidget(preferencesWidgetId, { pinned: true });
  },
});
