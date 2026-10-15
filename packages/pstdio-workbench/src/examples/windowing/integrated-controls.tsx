import { Button, HStack } from "@chakra-ui/react";
import { useSyncExternalStore } from "react";
import { kilnObjects, kilnPage, kilnResource } from "../showcases/kiln-data";
import { integratedLongNote, integratedTicketPage, integratedTickets } from "./integrated-fixture";
import { windowingExtensionId, windowingPages } from "./resources";
import type { WindowingControlsProps } from "./windowing-story";

export const IntegratedWindowingControls = (props: WindowingControlsProps) => {
  const { fixture, reload } = props;
  const { workbench, resources } = fixture;
  const sessions = useSyncExternalStore(resources.subscribeContext, () => resources.sessions);
  const navigate = (id: string) =>
    workbench.pageLocations.navigate({ kind: "page", page: workbench.pages.getPage(id)!.ref });
  return (
    <HStack aria-label="Integrated scenario controls" role="group" p="sm" gap="xs" flexWrap="wrap">
      {resources.workspaces.map((resource) => (
        <Button
          key={resource.id}
          size="xs"
          variant="outline"
          onClick={() => workbench.pageLocations.navigate({ kind: "page", page: windowingPages.workspace, resource })}
        >
          {resource.label}
        </Button>
      ))}
      {resources.notes.map((resource) => (
        <Button
          key={resource.id}
          size="xs"
          variant="outline"
          onClick={() =>
            workbench.pageLocations.navigate({ kind: "page", page: windowingPages.notes, resource, open: "pin" })
          }
        >
          {resource.id === integratedLongNote.id ? "Long note" : resource.label}
        </Button>
      ))}
      {sessions.map((resource) => (
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
      <Button size="xs" variant="outline" onClick={() => navigate("windowing.sessions")}>
        Sessions
      </Button>
      {integratedTickets.map((resource) => (
        <Button
          key={resource.id}
          size="xs"
          variant="outline"
          onClick={() => workbench.pageLocations.navigate({ kind: "page", page: integratedTicketPage, resource })}
        >
          {resource.label}
        </Button>
      ))}
      <Button size="xs" variant="outline" onClick={() => navigate("windowing.webview")}>
        Webview
      </Button>
      <Button size="xs" variant="outline" onClick={() => navigate("boombox.home")}>
        Boombox
      </Button>
      <Button
        size="xs"
        variant="outline"
        onClick={() =>
          workbench.pageLocations.navigate({
            kind: "page",
            page: kilnPage,
            resource: kilnResource(kilnObjects[0]),
          })
        }
      >
        Kiln
      </Button>
      <Button size="xs" variant="outline" onClick={() => fixture.startSession(resources.workspaces[0]!)}>
        Start session
      </Button>
      <Button size="xs" variant="outline" onClick={() => void workbench.resetPageLayout()}>
        Reset page layout
      </Button>
      <Button size="xs" variant="outline" onClick={() => void workbench.resetModeLayout()}>
        Reset mode layout
      </Button>
      <Button size="xs" onClick={() => void reload()}>
        Reload fixture
      </Button>
    </HStack>
  );
};
