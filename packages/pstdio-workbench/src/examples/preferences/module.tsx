import { Badge, Box, Button, Code, Grid, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type {
  PreferencePropertySchema,
  PreferenceSchemaContribution,
  PreferenceScopeRef,
  PreferenceValue,
  WorkbenchModuleContribution,
  WorkbenchPanelRenderInput,
} from "@pstdio/workbench";
import { useWorkbenchStore, WorkbenchIcon } from "@pstdio/workbench/react";
import { useState } from "react";

const preferencesWidgetId = "preferences.schemas";
const densityPreferenceName = "preferences.example.editorDensity";
const defaultRegionPreferenceName = "preferences.example.defaultOpenRegion";
const userScope = { scope: "user" } satisfies PreferenceScopeRef;
const projectScope = { scope: "project", scopeId: "storybook-project" } satisfies PreferenceScopeRef;
const preferenceNames = [densityPreferenceName, defaultRegionPreferenceName] as const;
const preferenceSchema = {
  properties: {
    [densityPreferenceName]: {
      type: "string",
      enum: ["comfortable", "compact"],
      default: "comfortable",
      scope: "user",
      description: "Controls the preferred editor density.",
    },
    [defaultRegionPreferenceName]: {
      type: "string",
      enum: ["main", "secondary", "main-right-menu"],
      default: "main",
      scope: "project",
      description: "Controls where new resource views open in this project.",
    },
  },
} satisfies PreferenceSchemaContribution;
const densityOptions = [
  { value: "comfortable", label: "Comfortable", icon: "PanelTop" },
  { value: "compact", label: "Compact", icon: "Rows3" },
] as const;
const defaultRegionOptions = [
  { value: "main", label: "Main", icon: "PanelTop" },
  { value: "secondary", label: "Bottom", icon: "PanelBottom" },
  { value: "main-right-menu", label: "Right", icon: "PanelRight" },
] as const;
const editorFiles = ["README.md", "extension.ts", "package.json"];
const formatPreferenceValue = (value: PreferenceValue | undefined) => String(value ?? "unset");
const SchemaRow = (props: { name: string; schema: PreferencePropertySchema }) => {
  const { name, schema } = props;
  return (
    <Box borderWidth="1px" borderColor="border.subtle" p="md">
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
          <Text textStyle="paragraph/XS/regular" color="fg.muted">
            {schema.scope === "user"
              ? "The same value follows the user across projects."
              : "Each project stores its own value."}
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
      variant={selected ? "primary" : "outline"}
    >
      <WorkbenchIcon name={icon} />
      {label}
    </Button>
  );
};
const PreferenceSchemasPanel = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const schemas = useWorkbenchStore(input.workbench.preferences.store, (state) => state.schemas);
  const [revision, setRevision] = useState(0);
  const density = input.workbench.preferences.getValue(densityPreferenceName, userScope);
  const defaultRegion = input.workbench.preferences.getValue(defaultRegionPreferenceName, projectScope);
  const setPreference = (name: string, value: PreferenceValue, scope: PreferenceScopeRef) => {
    input.workbench.preferences.setValue(name, value, scope);
    setRevision((current) => current + 1);
  };
  return (
    <ScrollArea
      h="full"
      minH="0"
      data-preference-revision={revision}
      contentProps={{ p: "lg", display: "flex", flexDirection: "column", gap: "lg" }}
    >
      <Stack gap="xs">
        <Text textStyle="heading/M/semibold">Declare a setting once</Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted" maxW="760px">
          A preference is a named setting that feature code can read. Its schema tells the workbench which values are
          allowed, which value to use by default, and where to save a user's choice.
        </Text>
      </Stack>

      <Stack gap="sm">
        <Text textStyle="label/M/semibold">1. The module declares the contract</Text>
        <Grid templateColumns={{ base: "1fr", lg: "repeat(2, minmax(0, 1fr))" }} gap="md">
          {preferenceNames.map((name) => (
            <SchemaRow key={name} name={name} schema={schemas[name] ?? preferenceSchema.properties[name]!} />
          ))}
        </Grid>
      </Stack>

      <Stack gap="sm">
        <Text textStyle="label/M/semibold">2. The settings UI writes values</Text>
        <Grid templateColumns={{ base: "1fr", lg: "repeat(2, minmax(0, 1fr))" }} gap="md">
          <Box borderWidth="1px" borderColor="border.subtle" p="md">
            <Stack gap="sm">
              <HStack justify="space-between" gap="sm" wrap="wrap">
                <Text textStyle="label/S/semibold">Editor density</Text>
                <Badge colorPalette="blue">saved for user</Badge>
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

          <Box borderWidth="1px" borderColor="border.subtle" p="md">
            <Stack gap="sm">
              <HStack justify="space-between" gap="sm" wrap="wrap">
                <Text textStyle="label/S/semibold">Default open region</Text>
                <Badge colorPalette="blue">saved for this project</Badge>
              </HStack>
              <HStack gap="xs" wrap="wrap">
                {defaultRegionOptions.map((option) => (
                  <PreferenceOptionButton
                    key={option.value}
                    icon={option.icon}
                    label={option.label}
                    selected={defaultRegion === option.value}
                    onClick={() => setPreference(defaultRegionPreferenceName, option.value, projectScope)}
                  />
                ))}
              </HStack>
            </Stack>
          </Box>
        </Grid>
      </Stack>

      <Stack gap="sm">
        <Text textStyle="label/M/semibold">3. Features read the current values</Text>
        <Grid templateColumns={{ base: "1fr", lg: "repeat(2, minmax(0, 1fr))" }} gap="md">
          <Box borderWidth="1px" borderColor="border.subtle" p="md">
            <Stack gap="sm">
              <HStack justify="space-between" gap="sm">
                <Text textStyle="label/S/semibold">Editor preview</Text>
                <Code colorPalette="gray">{formatPreferenceValue(density)}</Code>
              </HStack>
              <Stack gap={density === "compact" ? "2xs" : "sm"}>
                {editorFiles.map((file) => (
                  <Box key={file} borderWidth="1px" borderColor="border.subtle" px="sm" py="xs">
                    <Text textStyle="paragraph/S/regular">{file}</Text>
                  </Box>
                ))}
              </Stack>
            </Stack>
          </Box>

          <Box borderWidth="1px" borderColor="border.subtle" p="md">
            <Stack gap="sm">
              <HStack justify="space-between" gap="sm">
                <Text textStyle="label/S/semibold">New resources open in</Text>
                <Code colorPalette="gray">{formatPreferenceValue(defaultRegion)}</Code>
              </HStack>
              <HStack gap="xs" wrap="wrap">
                {defaultRegionOptions.map((option) => (
                  <Badge key={option.value} colorPalette={defaultRegion === option.value ? "blue" : "gray"}>
                    {option.label}
                  </Badge>
                ))}
              </HStack>
            </Stack>
          </Box>
        </Grid>
      </Stack>
    </ScrollArea>
  );
};
export const createPreferenceSchemasExampleModule = (): WorkbenchModuleContribution => ({
  id: "preferences-example",
  activate(ctx) {
    ctx.preferences.registerSchema(preferenceSchema);
    ctx.views.registerView({
      id: preferencesWidgetId,
      title: "Preference schemas",
      body: { kind: "react", render: (input) => <PreferenceSchemasPanel input={input} /> },
    });
    ctx.shellPlacements.registerPlacement({
      id: preferencesWidgetId,
      item: {
        kind: "view",
        presence: "fixed",
        view: {
          kind: "view",
          id: preferencesWidgetId,
        },
      },
      region: "main",
    });
  },
});
