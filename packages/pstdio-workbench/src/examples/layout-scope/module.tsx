import { Box, Button, Code, HStack, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import {
  createWorkbench,
  type LayoutPersistenceAdapter,
  type LayoutScope,
  type WorkbenchCore,
  type WorkbenchLayout,
  type WorkbenchModuleContribution,
} from "../../core";
import { useWorkbenchStore } from "../../react";

const PANEL_WIDGET_ID = "layout-scope.example.panel";
const SECONDARY_WIDGET_ID = "layout-scope.example.secondary";
const SIDENAV_WIDGET_ID = "layout-scope.example.sidenav";
const SCOPES: Array<{
  id: LayoutScope;
  label: string;
}> = [
  {
    id: "project/demo/mode/tickets/resource/ticket:PS-100",
    label: "Ticket PS-100",
  },
  {
    id: "project/demo/mode/tickets/resource/ticket:PS-200",
    label: "Ticket PS-200",
  },
  {
    id: "project/demo/mode/tickets/aggregate/tickets",
    label: "Tickets aggregate",
  },
];
const setSecondaryOpen = (workbench: WorkbenchCore, open: boolean) => {
  workbench.shell.setRegionOpen("secondary", open);
};
const createInMemoryAdapter = () => {
  const layouts = new Map<string, WorkbenchLayout>();
  return {
    layout: {
      getLayout: (scope) => layouts.get(scope ?? "__global__"),
      setLayout: (layout, scope) => {
        layouts.set(scope ?? "__global__", structuredClone(layout));
      },
    } satisfies LayoutPersistenceAdapter,
  };
};
interface SwitcherPanelProps {
  workbench: WorkbenchCore;
}
const SwitcherPanel = (props: SwitcherPanelProps) => {
  const { workbench } = props;
  const secondarySize = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions.secondary.size);
  const secondaryOpen = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions.secondary.visible);
  // `getPersistenceScope` lives outside the store; mirror it in local state so
  // the button highlight reflects switches even when scoped layouts coincide.
  const [activeScope, setActiveScope] = useState<LayoutScope | undefined>(() => workbench.layout.getPersistenceScope());
  const switchTo = (scope: LayoutScope) => {
    workbench.layout.setPersistenceScope(scope, {
      carryRegionState: ["sidenav"],
    });
    setActiveScope(scope);
  };
  return (
    <Stack p="lg" gap="md">
      <Text textStyle="title/S/semibold">Scoped layout persistence</Text>
      <Text textStyle="paragraph/M/regular">
        Ticket resources and the aggregate page keep independent Main/Secondary Panel state. The project-owned Sidenav
        is carried across every switch without remounting.
      </Text>
      <HStack gap="sm" wrap="wrap">
        {SCOPES.map((scope) => (
          <Button
            key={scope.label}
            size="sm"
            variant={scope.id === activeScope ? "primary" : "outline"}
            onClick={() => switchTo(scope.id)}
          >
            Switch to {scope.label}
          </Button>
        ))}
      </HStack>
      <HStack gap="sm" wrap="wrap">
        <Button size="sm" onClick={() => workbench.layout.setRegionSize("secondary", (secondarySize ?? 240) + 40)}>
          Secondary +40
        </Button>
        <Button
          size="sm"
          onClick={() => workbench.layout.setRegionSize("secondary", Math.max(160, (secondarySize ?? 240) - 40))}
        >
          Secondary -40
        </Button>
        <Button size="sm" onClick={() => setSecondaryOpen(workbench, !secondaryOpen)}>
          Toggle secondary
        </Button>
      </HStack>
      <Box>
        <Text textStyle="label/S/semibold">Active scope</Text>
        <Code colorPalette="gray">{activeScope ?? "global"}</Code>
      </Box>
      <Box>
        <Text textStyle="label/S/semibold">Resource-owned state</Text>
        <Text textStyle="paragraph/S/regular">
          secondary open = {String(secondaryOpen)} | size = {String(secondarySize ?? "default")}
        </Text>
      </Box>
    </Stack>
  );
};
const SidenavPanel = () => (
  <Stack p="md" gap="xs">
    <Text textStyle="label/S/semibold">Project Sidenav</Text>
    <Text textStyle="paragraph/S/regular">This project-owned chrome stays mounted while resource scopes rotate.</Text>
  </Stack>
);
export const createLayoutScopeExampleModule = (): WorkbenchModuleContribution => ({
  id: "layout-scope.example",
  activate(ctx) {
    ctx.views.registerView({
      id: PANEL_WIDGET_ID,
      title: "Scope switcher",
      body: { kind: "react", render: ({ workbench }) => <SwitcherPanel workbench={workbench} /> },
    });
    ctx.shellPlacements.registerPlacement({
      id: PANEL_WIDGET_ID,
      item: {
        kind: "view",
        presence: "fixed",
        view: {
          kind: "view",
          id: PANEL_WIDGET_ID,
        },
      },
      region: "main",
    });
    ctx.views.registerView({
      id: SIDENAV_WIDGET_ID,
      title: "Project Sidenav",
      body: { kind: "react", render: () => <SidenavPanel /> },
    });
    ctx.shellPlacements.registerPlacement({
      id: SIDENAV_WIDGET_ID,
      item: {
        kind: "view",
        presence: "fixed",
        view: {
          kind: "view",
          id: SIDENAV_WIDGET_ID,
        },
      },
      region: "sidenav",
    });
    ctx.views.registerView({
      id: SECONDARY_WIDGET_ID,
      title: "Resource details",
      body: { kind: "react", render: () => <SidenavPanel /> },
    });
    ctx.shellPlacements.registerPlacement({
      id: SECONDARY_WIDGET_ID,
      item: {
        kind: "view",
        presence: "fixed",
        view: {
          kind: "view",
          id: SECONDARY_WIDGET_ID,
        },
      },
      region: "secondary",
    });
  },
});
export const createLayoutScopeExampleWorkbench = () => {
  const persistence = createInMemoryAdapter();
  const workbench = createWorkbench({
    layoutPersistence: persistence.layout,
  });
  workbench.registerModule(createLayoutScopeExampleModule());
  const seedScope = (scope: LayoutScope, secondarySize: number, secondaryOpen: boolean) => {
    workbench.layout.setPersistenceScope(scope);
    workbench.layout.setRegionSize("secondary", secondarySize);
    setSecondaryOpen(workbench, secondaryOpen);
  };
  seedScope(SCOPES[0]!.id, 220, true);
  seedScope(SCOPES[1]!.id, 340, false);
  seedScope(SCOPES[2]!.id, 280, false);
  return workbench;
};
