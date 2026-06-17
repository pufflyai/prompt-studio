import { Box, Button, Code, HStack, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import {
  createWorkbenchCore,
  type LayoutPersistenceAdapter,
  type LayoutScope,
  type WorkbenchCore,
  type WorkbenchLayout,
  type WorkbenchModuleContribution,
} from "../../core";
import { useWorkbenchStore } from "../../react";

const PANEL_WIDGET_ID = "layout-scope.example.panel";
const PANEL_RENDERER_ID = "layout-scope.example.renderer";
const SIDEBAR_WIDGET_ID = "layout-scope.example.sidebar";
const SIDEBAR_RENDERER_ID = "layout-scope.example.sidebar-renderer";

const SCOPES: Array<{ id: LayoutScope | undefined; label: string }> = [
  { id: undefined, label: "global" },
  { id: "project:a", label: "project:a" },
  { id: "project:b", label: "project:b" },
];

const createInMemoryAdapter = () => {
  const stored = new Map<string, WorkbenchLayout>();
  const adapter: LayoutPersistenceAdapter = {
    getLayout: (scope) => stored.get(scope ?? "__global__"),
    setLayout: (layout, scope) => {
      stored.set(scope ?? "__global__", structuredClone(layout));
    },
  };
  return adapter;
};

interface SwitcherPanelProps {
  workbench: WorkbenchCore;
}

const SwitcherPanel = (props: SwitcherPanelProps) => {
  const { workbench } = props;
  const leftSize = useWorkbenchStore(workbench.layout.store, (state) => state.layout.areas.left.size);
  const leftVisible = useWorkbenchStore(workbench.layout.store, (state) => state.layout.areas.left.visible);
  // `getPersistenceScope` lives outside the store; mirror it in local state so
  // the button highlight reflects switches even when scoped layouts coincide.
  const [activeScope, setActiveScope] = useState<LayoutScope | undefined>(() => workbench.layout.getPersistenceScope());

  const switchTo = (scope: LayoutScope | undefined) => {
    workbench.layout.setPersistenceScope(scope);
    setActiveScope(scope);
  };

  return (
    <Stack p="lg" gap="md">
      <Text textStyle="title/S/semibold">Scoped layout persistence</Text>
      <Text textStyle="paragraph/M/regular">
        The three scopes are pre-seeded with different sidebar sizes — switch to see each one round-trip. Resize or
        toggle the sidebar to mutate the active scope; the change persists for that scope only.
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
        <Button size="sm" onClick={() => workbench.layout.setAreaSize("left", (leftSize ?? 240) + 40)}>
          Sidebar +40
        </Button>
        <Button size="sm" onClick={() => workbench.layout.setAreaSize("left", Math.max(160, (leftSize ?? 240) - 40))}>
          Sidebar -40
        </Button>
        <Button size="sm" onClick={() => workbench.commands.executeCommand("workbench.toggleSideBar")}>
          Toggle sidebar
        </Button>
      </HStack>
      <Box>
        <Text textStyle="label/S/semibold">Active scope</Text>
        <Code colorPalette="gray">{activeScope ?? "global"}</Code>
      </Box>
      <Box>
        <Text textStyle="label/S/semibold">Sidebar state</Text>
        <Text textStyle="paragraph/S/regular">
          visible = {String(leftVisible)} | size = {String(leftSize ?? "default")}
        </Text>
      </Box>
    </Stack>
  );
};

const SidebarPanel = () => (
  <Stack p="md" gap="xs">
    <Text textStyle="label/S/semibold">Sidebar</Text>
    <Text textStyle="paragraph/S/regular">Resize me — each scope persists the value independently.</Text>
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
      id: SIDEBAR_RENDERER_ID,
      render: () => <SidebarPanel />,
    });

    ctx.layout.registerWidget({
      id: PANEL_WIDGET_ID,
      title: "Scope switcher",
      area: "main",
      singleton: true,
      rendererId: PANEL_RENDERER_ID,
    });

    ctx.layout.registerWidget({
      id: SIDEBAR_WIDGET_ID,
      title: "Sidebar",
      area: "left",
      singleton: true,
      rendererId: SIDEBAR_RENDERER_ID,
    });
  },
});

export const createLayoutScopeExampleWorkbench = () => {
  const workbench = createWorkbenchCore({ layoutPersistence: createInMemoryAdapter() });
  workbench.registerModule(createLayoutScopeExampleModule());

  // Open the demo widgets in every scope and pre-seed each scope with a
  // different sidebar size so switching between them shows real per-scope
  // state. `setPersistenceScope` replaces the whole layout with the persisted
  // snapshot for that scope, so the widgets must exist in each one.
  const seedScope = (scope: LayoutScope | undefined, leftSize: number) => {
    workbench.layout.setPersistenceScope(scope);
    workbench.layout.openWidget(PANEL_WIDGET_ID);
    workbench.layout.openWidget(SIDEBAR_WIDGET_ID, { pinned: true });
    workbench.layout.setAreaSize("left", leftSize);
  };

  seedScope("project:a", 200);
  seedScope("project:b", 360);
  seedScope(undefined, 240);

  return workbench;
};
