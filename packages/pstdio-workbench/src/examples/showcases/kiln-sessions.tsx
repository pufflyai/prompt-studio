import { Stack, Text } from "@chakra-ui/react";
import type { ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchCore } from "../../core";

export const registerKilnSessions = (workbench: WorkbenchCore) => {
  const sessions: ResourceRef[] = [];
  const panel = { kind: "placement", extensionId: "storybook.showcases", id: "kiln.sessions" } as const;
  const createSession = () => {
    const number = sessions.length + 1;
    const resource = { type: "kiln.session", id: `session-${number}`, label: `Session ${number}` };
    sessions.push(resource);
    return resource;
  };
  workbench.resources.registerKind({ kind: "kiln.session", label: "Session" });
  workbench.resources.registerProvider({
    id: "kiln.sessions",
    kind: "kiln.session",
    list: () => sessions.map((resource) => ({ resource })),
  });
  workbench.views.registerView({
    id: "kiln.session",
    title: "Session",
    instancePolicy: "per-resource",
    body: {
      kind: "react",
      render: ({ instance }) => (
        <Stack p="md" gap="sm">
          <Text textStyle="heading/S/semibold">{instance.resource?.label}</Text>
          <Text color="fg.muted">Describe a change to the scene.</Text>
        </Stack>
      ),
    },
  });
  workbench.modePlacements.registerPlacement({
    id: "kiln.sessions",
    ref: panel,
    modeId: "kiln",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "kiln.session" }],
        view: { kind: "view", id: "kiln.session" },
        cardinality: "many",
      },
    },
  });
  workbench.commands.registerCommand(
    { id: "kiln.new-session", label: "New session" },
    {
      execute: async (_args, context) => {
        await (context?.navigation ?? workbench.navigation).openTarget({
          kind: "panel",
          panel,
          resource: createSession(),
          open: "pin",
        });
      },
    },
  );
  workbench.modePlacements.openPlacement({ panel, resource: createSession(), open: "pin" });
  const inspector = workbench.layout.listPanelInstances("side").find((item) => item.viewId === "kiln.inspector");
  if (inspector) workbench.layout.activatePanel(inspector.instanceId);
};
