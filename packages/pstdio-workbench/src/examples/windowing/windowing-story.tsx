import { Box, Button, HStack, Stack, type StackProps, Text } from "@chakra-ui/react";
import type { ThemePreference } from "@pstdio/ui";
import { type ComponentType, useEffect, useState } from "react";
import { useWorkbenchStore, useWorkbenchThemePreferences, Workbench, WorkbenchThemeProvider } from "../../react";
import { boomboxTheme, kilnTheme } from "../showcases/themes";
import { createWindowingFixture, type WindowingFixture, type WindowingMode } from "./fixture";
import { WindowingModeControls } from "./page-mode-controls";
import { WindowingRemovalControls } from "./removal-controls";
import { WindowingResetControls } from "./reset-controls";
import { windowingExtensionId, windowingPages } from "./resources";
import { WindowingSessionStartControls } from "./session-start-controls";

export interface WindowingControlsProps {
  fixture: WindowingFixture;
  reload(): Promise<void>;
}

const initialThemePreferences = { windowing: undefined, boombox: boomboxTheme.id, kiln: kilnTheme.id };

const WindowingControls = (props: WindowingControlsProps) => {
  const { fixture, reload } = props;
  const { workbench, resources } = fixture;
  const size = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions.secondary.size);
  return (
    <HStack
      role="group"
      aria-label="Windowing controls"
      p="sm"
      gap="sm"
      flexWrap="wrap"
      borderBottomWidth="1px"
      borderColor="border.subtle"
    >
      {fixture.resetControls && <WindowingResetControls workbench={workbench} />}
      {fixture.removalControls && <WindowingRemovalControls fixture={fixture} />}
      {fixture.sessionStarts && <WindowingSessionStartControls fixture={fixture} />}
      {fixture.pageModes && <WindowingModeControls workbench={workbench} />}
      {fixture.contextNavigation && (
        <Button
          size="xs"
          variant="outline"
          onClick={() =>
            resources.updateSessionContext("session-2", { type: "project", id: "windowing-project", label: "Project" })
          }
        >
          Use project session context
        </Button>
      )}
      {!fixture.pageModes &&
        resources.workspaces.map((resource) => (
          <Button
            key={resource.id}
            size="xs"
            variant="outline"
            onClick={() => workbench.pageLocations.navigate({ kind: "page", page: windowingPages.workspace, resource })}
          >
            {resource.label}
          </Button>
        ))}
      {!fixture.pageModes &&
        resources.notes.map((resource) => (
          <Button
            key={resource.id}
            size="xs"
            variant="outline"
            onClick={() =>
              workbench.pageLocations.navigate({ kind: "page", page: windowingPages.notes, resource, open: "pin" })
            }
          >
            {resource.label}
          </Button>
        ))}
      {!fixture.pageModes &&
        resources.sessions.map((resource) => (
          <Button
            key={resource.id}
            size="xs"
            variant="outline"
            onClick={() =>
              void workbench.navigation.openTarget({
                kind: "panel",
                panel: { kind: "placement", extensionId: windowingExtensionId, id: "sessions" },
                resource,
                open: "pin",
              })
            }
          >
            {resource.label}
          </Button>
        ))}
      <Button
        size="xs"
        variant="outline"
        onClick={() => workbench.pageLocations.navigate({ kind: "page", page: windowingPages.sessions })}
      >
        Sessions
      </Button>
      <Button
        size="xs"
        variant="outline"
        onClick={() => workbench.pageLocations.navigate({ kind: "page", page: windowingPages.webview })}
      >
        Webview
      </Button>
      <Button
        size="xs"
        variant="outline"
        onClick={() => workbench.layout.setRegionSize("secondary", (size ?? 240) + 40)}
      >
        Grow Secondary
      </Button>
      <Button size="xs" onClick={() => void reload()}>
        Reload fixture
      </Button>
      <Text aria-label="Secondary size" textStyle="paragraph/XS/regular">
        {size ?? 240}
      </Text>
    </HStack>
  );
};

const ShowcaseControls = (props: WindowingControlsProps) => {
  const { fixture, reload } = props;
  return (
    <HStack p="sm">
      <Text textStyle="label/S/semibold">{fixture.mode}</Text>
      {fixture.resetControls && <WindowingResetControls workbench={fixture.workbench} />}
      <Button size="xs" onClick={() => void reload()}>
        New fixture
      </Button>
    </HStack>
  );
};

interface WindowingStoryProps {
  width?: StackProps["width"];
  initialPage?: "workspace" | "webview";
  mode?: WindowingMode;
  createFixture?: () => WindowingFixture;
  controls?: ComponentType<WindowingControlsProps>;
  initialThemePreference?: ThemePreference;
}

export const WindowingStory = (props: WindowingStoryProps) => {
  const {
    width,
    initialPage = "workspace",
    mode = "windowing",
    createFixture,
    controls,
    initialThemePreference,
  } = props;
  const [fixture] = useState(() => {
    const next = createFixture ? createFixture() : createWindowingFixture(mode);
    if (initialPage === "webview")
      next.workbench.pageLocations.navigate({ kind: "page", page: windowingPages.webview });
    return next;
  });
  const [generation, setGeneration] = useState(0);
  const workbench = fixture.workbench;
  const themePreferences = useWorkbenchThemePreferences(workbench);
  const [error, setError] = useState("");
  const Controls = controls ?? (fixture.mode === "windowing" ? WindowingControls : ShowcaseControls);
  useEffect(
    () => () => {
      void fixture.dispose();
    },
    [fixture],
  );
  const reload = async () => {
    try {
      await fixture.reload();
      setGeneration((value) => value + 1);
    } catch (cause) {
      setError(String(cause));
    }
  };
  return (
    <WorkbenchThemeProvider
      initialThemePreference={initialThemePreference ?? initialThemePreferences[fixture.mode]}
      themePreferences={themePreferences}
    >
      <Stack key={generation} w={width} h="100dvh" gap="0" overflow="hidden">
        <Controls fixture={fixture} reload={reload} />
        {error && (
          <Text role="alert" color="fg.error">
            {error}
          </Text>
        )}
        <Box flex="1" minH="0" minW="0">
          <Workbench workbench={workbench} />
        </Box>
      </Stack>
    </WorkbenchThemeProvider>
  );
};
