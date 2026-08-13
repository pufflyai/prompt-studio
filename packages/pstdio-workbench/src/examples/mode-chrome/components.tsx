import { Box, Heading, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { useSyncExternalStore } from "react";
import type { WorkbenchCore, WorkbenchPanelRenderInput } from "../../core";
import { WorkbenchIcon } from "../../react";
import { chromeModes } from "./data";

const useActiveModeId = (workbench: WorkbenchCore) =>
  useSyncExternalStore(
    (onStoreChange) => workbench.modes.onDidChangeActive(onStoreChange).dispose,
    () => workbench.modes.getActiveModeId(),
  );

// The activity rail is plain host UI: icon buttons that switch modes. Staged by
// the studio mode, cleared by modes that do not declare it.
export const ChromeActivityRail = (props: { input: WorkbenchPanelRenderInput }) => {
  const workbench = props.input.workbench;
  const activeModeId = useActiveModeId(workbench);

  return (
    <Stack as="nav" align="center" gap="2xs" paddingY="sm" h="full" aria-label="Activity">
      {Object.values(chromeModes).map((mode) => (
        <Tooltip key={mode.id} content={mode.label} positioning={{ placement: "right" }}>
          <IconButton
            aria-label={mode.label}
            variant={activeModeId === mode.id ? "subtle" : "ghost"}
            size="sm"
            onClick={() => workbench.modes.setActiveMode(mode.id)}
          >
            <WorkbenchIcon name={mode.icon} size={18} />
          </IconButton>
        </Tooltip>
      ))}
    </Stack>
  );
};

export const ChromeStatusStrip = (props: { input: WorkbenchPanelRenderInput }) => {
  const workbench = props.input.workbench;
  const activeModeId = useActiveModeId(workbench);
  const mode = Object.values(chromeModes).find((candidate) => candidate.id === activeModeId);

  return (
    <HStack gap="md" paddingX="md" h="full" whiteSpace="nowrap">
      <Text textStyle="label/XS/medium">Mode chrome</Text>
      <Text textStyle="label/XS/regular" color="fg.muted">
        {mode ? `${mode.label} mode` : "No mode"}
      </Text>
      <Text textStyle="label/XS/regular" color="fg.muted">
        Status region · one native widget
      </Text>
    </HStack>
  );
};

export const ChromeOverview = () => (
  <Box padding="lg">
    <Stack gap="sm" maxW="34rem">
      <Heading size="md">Studio overview</Heading>
      <Text color="fg.muted">
        This tab is the Location. Catalog and Notes are Sub Panels beside it — activating them never creates a second
        Location, so the tabs stay stable. The Catalog query is artificially slow: its first visit shows a loading
        state, and every revisit renders the cached rows instantly while the query refreshes.
      </Text>
      <Text color="fg.muted">
        Selecting a Catalog row opens the item in the Side Panel as an inspector, without leaving this Location. The
        activity rail and the status strip are staged by this mode and removed by the Library mode.
      </Text>
    </Stack>
  </Box>
);

export const ChromeNotes = () => (
  <Box padding="lg">
    <Text color="fg.muted">A second Sub Panel, so the tab strip shows one Location and two Sub Panels.</Text>
  </Box>
);

export const ChromeLibraryPage = () => (
  <Box padding="lg">
    <Stack gap="sm" maxW="34rem">
      <Heading size="md">Library</Heading>
      <Text color="fg.muted">
        This mode declares no activity or status chrome, so entering it clears both regions and the full-width layout
        returns. Switch back through the command palette mode switcher or the Studio story controls.
      </Text>
    </Stack>
  </Box>
);

export const ChromeItemInspector = (props: { input: WorkbenchPanelRenderInput }) => {
  const resource = props.input.instance.resource;

  return (
    <Box padding="lg">
      <Stack gap="sm">
        <Heading size="sm">{resource?.label ?? "Select a catalog item"}</Heading>
        <Text color="fg.muted">
          {resource
            ? `Inspector for ${resource.id}. It opened in the Side Panel without switching the Location.`
            : "Selecting a Catalog row binds this Side Panel inspector to the item."}
        </Text>
      </Stack>
    </Box>
  );
};

export const ChromeExtraPanel = (props: { name: string }) => (
  <Box padding="lg">
    <Heading size="sm">{props.name}</Heading>
    <Text color="fg.muted">Added from the header's plus menu.</Text>
  </Box>
);

export const ChromeBoardHost = () => (
  <Box padding="lg">
    <Text color="fg.muted">This Location presents only Sub Panels. Add one from the plus menu.</Text>
  </Box>
);

export const ChromeBoardView = (props: { name: string; hint: string }) => (
  <Box padding="lg">
    <Stack gap="sm" maxW="34rem">
      <Heading size="sm">{props.name}</Heading>
      <Text color="fg.muted">{props.hint}</Text>
    </Stack>
  </Box>
);
