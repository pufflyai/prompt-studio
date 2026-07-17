import { Box, Button, Code, HStack, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import {
  createWorkbenchCore,
  type LayoutPersistenceAdapter,
  type LayoutScope,
  layoutScopeKey,
  type WorkbenchCore,
  type WorkbenchLayout,
  type WorkbenchModuleContribution,
} from "../../core";
import { useWorkbenchStore } from "../../react";

const RESOURCE_WIDGET_ID = "layout-scope.example.resource";
const RESOURCE_RENDERER_ID = "layout-scope.example.resource-renderer";
const SIDEBAR_WIDGET_ID = "layout-scope.example.sidebar";
const SIDEBAR_RENDERER_ID = "layout-scope.example.sidebar-renderer";

const SCOPE_A = { mode: "workspace", resource: "workspace:a" } satisfies LayoutScope;
const SCOPE_B = { mode: "workspace", resource: "workspace:b" } satisfies LayoutScope;
const SCOPES = [
  { id: SCOPE_A, label: "workspace:a" },
  { id: SCOPE_B, label: "workspace:b" },
];

const createInMemoryAdapter = () => {
  const stored = new Map<string, WorkbenchLayout>();
  const adapter: LayoutPersistenceAdapter = {
    getLayout: (scope) => stored.get(layoutScopeKey(scope)),
    setLayout: (layout, scope) => {
      stored.set(layoutScopeKey(scope), structuredClone(layout));
    },
  };
  return adapter;
};

interface SwitcherPanelProps {
  workbench: WorkbenchCore;
}

const SwitcherPanel = (props: SwitcherPanelProps) => {
  const { workbench } = props;
  const leftSize = useWorkbenchStore(workbench.layout.store, (state) => state.layout.nodes.left?.size);
  const leftVisible = useWorkbenchStore(workbench.layout.store, (state) => state.layout.nodes.left?.collapsed !== true);
  const secondarySize = useWorkbenchStore(workbench.layout.store, (state) => state.layout.nodes.secondary?.size);
  const [activeScope, setActiveScope] = useState<LayoutScope | undefined>(() => workbench.layout.getPersistenceScope());

  const switchTo = (scope: LayoutScope) => {
    workbench.layout.setPersistenceScope(scope);
    setActiveScope(scope);
  };

  return (
    <Stack p="md" gap="md">
      <Text textStyle="title/S/semibold">Per-slot layout scope</Text>
      <Text textStyle="paragraph/S/regular">
        This project-owned sidebar stays mounted while the resource-owned editor and secondary size swap independently.
      </Text>
      <HStack gap="sm" wrap="wrap">
        {SCOPES.map((scope) => (
          <Button
            key={scope.label}
            size="sm"
            variant={layoutScopeKey(scope.id) === layoutScopeKey(activeScope) ? "primary" : "outline"}
            onClick={() => switchTo(scope.id)}
          >
            {scope.label}
          </Button>
        ))}
      </HStack>
      <HStack gap="sm" wrap="wrap">
        <Button size="sm" onClick={() => workbench.layout.setAreaSize("left", (leftSize ?? 240) + 40)}>
          Project slot +40
        </Button>
        <Button size="sm" onClick={() => workbench.layout.setAreaSize("secondary", (secondarySize ?? 240) + 40)}>
          Resource slot +40
        </Button>
        <Button size="sm" onClick={() => workbench.commands.executeCommand("workbench.toggleSideBar")}>
          Toggle sidebar
        </Button>
      </HStack>
      <Box>
        <Text textStyle="label/S/semibold">Active scope</Text>
        <Code colorPalette="gray">{layoutScopeKey(activeScope)}</Code>
      </Box>
      <Text textStyle="paragraph/S/regular">
        sidebar visible = {String(leftVisible)} | sidebar size = {String(leftSize ?? "default")} | secondary size ={" "}
        {String(secondarySize ?? "default")}
      </Text>
    </Stack>
  );
};

const ResourcePanel = () => (
  <Stack p="lg" gap="sm">
    <Text textStyle="title/S/semibold">Resource-owned editor</Text>
    <Text textStyle="paragraph/M/regular">The active tab title and secondary size round-trip with this resource.</Text>
  </Stack>
);

export const createLayoutScopeExampleModule = (): WorkbenchModuleContribution => ({
  id: "layout-scope.example",
  activate(ctx) {
    ctx.renderers.registerRenderer({
      id: SIDEBAR_RENDERER_ID,
      render: ({ workbench }) => <SwitcherPanel workbench={workbench} />,
    });
    ctx.renderers.registerRenderer({ id: RESOURCE_RENDERER_ID, render: () => <ResourcePanel /> });
    ctx.layout.registerWidget({
      id: SIDEBAR_WIDGET_ID,
      title: "Scope switcher",
      area: "left",
      singleton: true,
      rendererId: SIDEBAR_RENDERER_ID,
    });
    ctx.layout.registerWidget({
      id: RESOURCE_WIDGET_ID,
      title: "Resource",
      area: "main",
      singleton: true,
      rendererId: RESOURCE_RENDERER_ID,
    });
  },
});

export const createLayoutScopeExampleWorkbench = () => {
  const workbench = createWorkbenchCore({ layoutPersistence: createInMemoryAdapter() });
  workbench.registerModule(createLayoutScopeExampleModule());

  workbench.layout.setPersistenceScope({ mode: "workspace" });
  workbench.layout.openWidget(SIDEBAR_WIDGET_ID, { pinned: true });
  workbench.layout.setAreaSize("left", 240);
  workbench.layout.persist();

  const seedResource = (scope: LayoutScope, secondarySize: number) => {
    workbench.layout.setPersistenceScope(scope);
    workbench.layout.openWidget(RESOURCE_WIDGET_ID, {
      resource: { kind: "workspace", uri: scope.resource ?? scope.mode, label: scope.resource },
      title: scope.resource,
    });
    workbench.layout.setAreaSize("secondary", secondarySize);
    workbench.layout.persist();
  };

  seedResource(SCOPE_A, 200);
  seedResource(SCOPE_B, 360);
  workbench.layout.setPersistenceScope(SCOPE_A);

  return workbench;
};
