import { Box, Button, Code, HStack, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import {
  createWorkbenchCore,
  type LayoutPersistenceAdapter,
  type LayoutScope,
  type WorkbenchCore,
  type WorkbenchLayout,
  type WorkbenchModuleContribution,
  type WorkbenchPanelsPersistenceAdapter,
} from "../../core";
import { useWorkbenchStore } from "../../react";

const PANEL_WIDGET_ID = "layout-scope.example.panel";
const PANEL_RENDERER_ID = "layout-scope.example.renderer";
const SECONDARY_WIDGET_ID = "layout-scope.example.secondary";
const SIDENAV_WIDGET_ID = "layout-scope.example.sidenav";
const SIDENAV_RENDERER_ID = "layout-scope.example.sidenav-renderer";

const SCOPES: Array<{ id: LayoutScope; label: string }> = [
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
  workbench.panels.setOpen("secondary", open);
  workbench.layout.setRegionVisible("secondary", open);
};

const createInMemoryAdapter = () => {
  const layouts = new Map<string, WorkbenchLayout>();
  const panels = new Map<string, Parameters<WorkbenchPanelsPersistenceAdapter["setPanelStates"]>[0]>();
  return {
    layout: {
      getLayout: (scope) => layouts.get(scope ?? "__global__"),
      setLayout: (layout, scope) => {
        layouts.set(scope ?? "__global__", structuredClone(layout));
      },
    } satisfies LayoutPersistenceAdapter,
    panels: {
      getPanelStates: (scope) => panels.get(scope ?? "__global__"),
      setPanelStates: (state, scope) => {
        panels.set(scope ?? "__global__", structuredClone(state));
      },
    } satisfies WorkbenchPanelsPersistenceAdapter,
  };
};

interface SwitcherPanelProps {
  workbench: WorkbenchCore;
}

const SwitcherPanel = (props: SwitcherPanelProps) => {
  const { workbench } = props;
  const secondarySize = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions.secondary.size);
  const secondaryOpen = useWorkbenchStore(workbench.panels.store, (state) => state.openByRegionId.secondary ?? true);
  // `getPersistenceScope` lives outside the store; mirror it in local state so
  // the button highlight reflects switches even when scoped layouts coincide.
  const [activeScope, setActiveScope] = useState<LayoutScope | undefined>(() => workbench.layout.getPersistenceScope());

  const switchTo = (scope: LayoutScope) => {
    workbench.panels.setPersistenceScope(scope);
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
    ctx.renderers.registerRenderer({
      id: PANEL_RENDERER_ID,
      render: ({ workbench }) => <SwitcherPanel workbench={workbench} />,
    });

    ctx.renderers.registerRenderer({
      id: SIDENAV_RENDERER_ID,
      render: () => <SidenavPanel />,
    });

    ctx.layout.registerPanel({
      id: PANEL_WIDGET_ID,
      title: "Scope switcher",
      region: "main",
      singleton: true,
      rendererId: PANEL_RENDERER_ID,
    });

    ctx.layout.registerPanel({
      id: SIDENAV_WIDGET_ID,
      title: "Project Sidenav",
      region: "sidenav",
      singleton: true,
      rendererId: SIDENAV_RENDERER_ID,
    });

    ctx.layout.registerPanel({
      id: SECONDARY_WIDGET_ID,
      title: "Resource details",
      region: "secondary",
      singleton: true,
      rendererId: SIDENAV_RENDERER_ID,
    });
  },
});

export const createLayoutScopeExampleWorkbench = () => {
  const persistence = createInMemoryAdapter();
  const workbench = createWorkbenchCore({
    layoutPersistence: persistence.layout,
    panelsPersistence: persistence.panels,
  });
  workbench.registerModule(createLayoutScopeExampleModule());

  const seedScope = (scope: LayoutScope, secondarySize: number, secondaryOpen: boolean) => {
    workbench.panels.setPersistenceScope(scope);
    workbench.layout.setPersistenceScope(scope);
    workbench.layout.openPanel(PANEL_WIDGET_ID);
    workbench.layout.openPanel(SIDENAV_WIDGET_ID, { pinned: true });
    workbench.layout.openPanel(SECONDARY_WIDGET_ID);
    workbench.layout.setRegionSize("secondary", secondarySize);
    setSecondaryOpen(workbench, secondaryOpen);
  };

  seedScope(SCOPES[0]!.id, 220, true);
  seedScope(SCOPES[1]!.id, 340, false);
  seedScope(SCOPES[2]!.id, 280, false);

  return workbench;
};
