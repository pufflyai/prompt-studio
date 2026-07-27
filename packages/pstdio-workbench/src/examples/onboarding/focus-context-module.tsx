import { Badge, Box, Button, Code, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type {
  WorkbenchCore,
  WorkbenchModuleContext,
  WorkbenchModuleContribution,
  WorkbenchPanelRenderInput,
} from "../../core";
import { workbenchCommandPaletteMenuPath } from "../../core";
import { useWorkbenchStore, WorkbenchIcon } from "../../react";

const FOCUS_CONTEXT_RENDERER_ID = "onboarding.focus-context.renderer";
const FOCUS_CONTEXT_MAIN_WIDGET_ID = "onboarding.focus-context.main";
const FOCUS_CONTEXT_SIDENAV_WIDGET_ID = "onboarding.focus-context.sidenav";
const FOCUS_CONTEXT_PANEL_WIDGET_ID = "onboarding.focus-context.panel";
const FOCUS_CONTEXT_STATUS_WIDGET_ID = "onboarding.focus-context.status";
const MARK_SELECTED_COMMAND_ID = "onboarding.focus-context.mark-selected";
const SELECTED_KIND_CONTEXT_KEY = "onboarding.selectedKind";
const REVIEW_READY_CONTEXT_KEY = "onboarding.reviewReady";
const SELECTED_GUIDE_CONTEXT_VALUE = "guide";

interface FocusContextPanelProps {
  input: WorkbenchPanelRenderInput;
  context: WorkbenchModuleContext["context"];
}

interface ContextStatusProps {
  workbench: WorkbenchCore;
}

interface ActionAvailabilityProps {
  selectedKind: string;
  markCommandAvailable: boolean;
}

const setSelectedGuide = (context: WorkbenchModuleContext["context"]) => {
  context.set(SELECTED_KIND_CONTEXT_KEY, SELECTED_GUIDE_CONTEXT_VALUE);
  context.set(REVIEW_READY_CONTEXT_KEY, true);
};

const clearSelectedGuide = (context: WorkbenchModuleContext["context"]) => {
  context.delete(SELECTED_KIND_CONTEXT_KEY);
  context.set(REVIEW_READY_CONTEXT_KEY, false);
};

const ActionAvailability = (props: ActionAvailabilityProps) => {
  const { selectedKind, markCommandAvailable } = props;
  const guideSelected = selectedKind === SELECTED_GUIDE_CONTEXT_VALUE;
  const actions = [
    { label: "Focus main, sidenav, or panel", context: "always", available: true },
    {
      label: "Select guide",
      context: `${SELECTED_KIND_CONTEXT_KEY} != ${SELECTED_GUIDE_CONTEXT_VALUE}`,
      available: !guideSelected,
    },
    {
      label: "Clear selection",
      context: `${SELECTED_KIND_CONTEXT_KEY} == ${SELECTED_GUIDE_CONTEXT_VALUE}`,
      available: guideSelected,
    },
    {
      label: "Mark selected guide",
      context: `${SELECTED_KIND_CONTEXT_KEY} == ${SELECTED_GUIDE_CONTEXT_VALUE} && mainFocus`,
      available: markCommandAvailable,
    },
  ];

  return (
    <Stack gap="xs" p="md" borderWidth="1px" borderColor="border.subtle" bg="bg.subtle">
      <Text textStyle="label/S/semibold">Available actions</Text>
      {actions.map((action) => (
        <HStack key={action.label} justify="space-between" gap="md" align="flex-start">
          <Box minW="0">
            <Text textStyle="paragraph/S/medium">{action.label}</Text>
            <Code colorPalette="gray" whiteSpace="normal">
              {action.context}
            </Code>
          </Box>
          <Badge colorPalette={action.available ? "green" : "gray"}>{action.available ? "enabled" : "disabled"}</Badge>
        </HStack>
      ))}
    </Stack>
  );
};

const FocusContextPanel = (props: FocusContextPanelProps) => {
  const { input, context } = props;
  const values = useWorkbenchStore(input.workbench.context.store, (state) => state.values);
  const sidenavVisible = useWorkbenchStore(
    input.workbench.layout.store,
    (state) => state.layout.regions.sidenav.visible,
  );
  const secondaryPanelVisible = useWorkbenchStore(
    input.workbench.layout.store,
    (state) => state.layout.regions.secondary.visible,
  );
  const activeRegion = useWorkbenchStore(input.workbench.focus.store, (state) => state.activeRegion) ?? "none";
  const selectedKindValue = values[SELECTED_KIND_CONTEXT_KEY];
  const selectedKind = typeof selectedKindValue === "string" ? selectedKindValue : "none";
  const guideSelected = selectedKind === SELECTED_GUIDE_CONTEXT_VALUE;
  const markCommandAvailable = input.workbench.commands.isCommandVisible(MARK_SELECTED_COMMAND_ID);

  return (
    <Stack h="full" minH="0" p="lg" gap="md" bg="bg">
      <HStack gap="sm" wrap="wrap">
        <Badge colorPalette="green">focus {activeRegion}</Badge>
        <Badge colorPalette={selectedKind === SELECTED_GUIDE_CONTEXT_VALUE ? "blue" : "gray"}>
          selected {selectedKind}
        </Badge>
        <Badge colorPalette={markCommandAvailable ? "purple" : "gray"}>
          command {markCommandAvailable ? "available" : "disabled"}
        </Badge>
      </HStack>

      <Stack gap="sm" maxW="720px">
        <Text textStyle="paragraph/M/regular">
          Focus updates context keys such as <Code colorPalette="gray">mainFocus</Code>,{" "}
          <Code colorPalette="gray">sidenavFocus</Code>, <Code colorPalette="gray">secondaryFocus</Code>, and{" "}
          <Code colorPalette="gray">sideFocus</Code>.
        </Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Selecting the guide sets a module-owned context key. The command is only available when a guide is selected
          and the main region has focus.
        </Text>
      </Stack>

      <ActionAvailability selectedKind={selectedKind} markCommandAvailable={markCommandAvailable} />

      <HStack gap="sm" wrap="wrap">
        <Button size="sm" onClick={() => input.workbench.focus.setActiveRegion("main")}>
          <WorkbenchIcon name="PanelTop" />
          Focus main
        </Button>
        <Button size="sm" disabled={!sidenavVisible} onClick={() => input.workbench.focus.setActiveRegion("sidenav")}>
          <WorkbenchIcon name="PanelLeft" />
          Focus sidenav
        </Button>
        <Button
          size="sm"
          disabled={!secondaryPanelVisible}
          onClick={() => input.workbench.focus.setActiveRegion("secondary")}
        >
          <WorkbenchIcon name="PanelBottom" />
          Focus panel
        </Button>
        <Button size="sm" variant="subtle" disabled={guideSelected} onClick={() => setSelectedGuide(context)}>
          <WorkbenchIcon name="FileCheck" />
          Select guide
        </Button>
        <Button size="sm" variant="ghost" disabled={!guideSelected} onClick={() => clearSelectedGuide(context)}>
          Clear selection
        </Button>
      </HStack>

      <Button
        alignSelf="flex-start"
        disabled={!markCommandAvailable}
        size="sm"
        onClick={() => input.workbench.commands.executeCommand(MARK_SELECTED_COMMAND_ID)}
      >
        <WorkbenchIcon name="CheckCircle" />
        Mark selected guide
      </Button>
    </Stack>
  );
};

const ContextStatus = (props: ContextStatusProps) => {
  const { workbench } = props;
  const values = useWorkbenchStore(workbench.context.store, (state) => state.values);
  const activeRegion = useWorkbenchStore(workbench.focus.store, (state) => state.activeRegion) ?? "none";

  return (
    <HStack h="full" gap="xs" px="sm">
      <WorkbenchIcon name="Crosshair" size={14} />
      <Text textStyle="label/XS/regular">focus {activeRegion}</Text>
      <Text textStyle="label/XS/regular" color="fg.muted">
        selected {values[SELECTED_KIND_CONTEXT_KEY] ?? "none"}
      </Text>
    </HStack>
  );
};

const ContextSnapshot = (props: ContextStatusProps) => {
  const { workbench } = props;
  const values = useWorkbenchStore(workbench.context.store, (state) => state.values);

  return (
    <ScrollArea h="full" bg="bg.subtle" contentProps={{ p: "md" }}>
      <Text textStyle="label/S/semibold">Context keys</Text>
      <Text as="pre" mt="sm" fontFamily="mono" fontSize="xs" whiteSpace="pre-wrap">
        {JSON.stringify(values, null, 2)}
      </Text>
    </ScrollArea>
  );
};

const FocusContextSidenav = (props: ContextStatusProps) => {
  const { workbench } = props;
  const activeRegion = useWorkbenchStore(workbench.focus.store, (state) => state.activeRegion) ?? "none";

  return (
    <Stack h="full" p="md" gap="sm" bg="bg.subtle">
      <Text textStyle="label/S/semibold">Focus regions</Text>
      {["sidenav", "main", "panel"].map((region) => (
        <HStack key={region} gap="xs">
          <Badge colorPalette={activeRegion === region ? "green" : "gray"}>
            {activeRegion === region ? "active" : "idle"}
          </Badge>
          <Text textStyle="paragraph/S/regular">{region}</Text>
        </HStack>
      ))}
    </Stack>
  );
};

export const createFocusContextModule = (): WorkbenchModuleContribution => ({
  id: "onboarding.focus-context",
  activate(ctx) {
    ctx.layout.registerPanel({
      closable: false,
      id: FOCUS_CONTEXT_MAIN_WIDGET_ID,
      title: "Focus and context",
      region: "main",
      singleton: true,
      rendererId: FOCUS_CONTEXT_RENDERER_ID,
    });
    ctx.layout.registerPanel({
      closable: false,
      id: FOCUS_CONTEXT_SIDENAV_WIDGET_ID,
      title: "Focus",
      region: "sidenav",
      regionSize: { defaultPx: 250, minPx: 220 },
      rendererId: FOCUS_CONTEXT_RENDERER_ID,
    });
    ctx.layout.registerPanel({
      closable: false,
      id: FOCUS_CONTEXT_PANEL_WIDGET_ID,
      title: "Context",
      region: "secondary",
      regionSize: { defaultPx: 220, minPx: 160 },
      rendererId: FOCUS_CONTEXT_RENDERER_ID,
    });
    ctx.layout.registerPanel({
      closable: false,
      id: FOCUS_CONTEXT_STATUS_WIDGET_ID,
      title: "Focus status",
      region: "status",
      rendererId: FOCUS_CONTEXT_RENDERER_ID,
    });

    ctx.renderers.registerRenderer({
      id: FOCUS_CONTEXT_RENDERER_ID,
      render: (input) => {
        if (input.panel.id === FOCUS_CONTEXT_SIDENAV_WIDGET_ID)
          return <FocusContextSidenav workbench={input.workbench} />;
        if (input.panel.id === FOCUS_CONTEXT_PANEL_WIDGET_ID) return <ContextSnapshot workbench={input.workbench} />;
        if (input.panel.id === FOCUS_CONTEXT_STATUS_WIDGET_ID) return <ContextStatus workbench={input.workbench} />;
        return <FocusContextPanel input={input} context={ctx.context} />;
      },
    });

    ctx.commands.registerCommand(
      {
        id: MARK_SELECTED_COMMAND_ID,
        label: "Mark selected guide",
        category: "Onboarding",
        icon: "CheckCircle",
        when: `${SELECTED_KIND_CONTEXT_KEY} == ${SELECTED_GUIDE_CONTEXT_VALUE} && mainFocus`,
      },
      {
        execute: () => ctx.notifications.show({ level: "success", title: "Selected guide marked" }),
      },
    );
    ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
      commandId: MARK_SELECTED_COMMAND_ID,
      group: "Onboarding",
    });

    ctx.context.set(REVIEW_READY_CONTEXT_KEY, false);
    ctx.layout.openPanel(FOCUS_CONTEXT_SIDENAV_WIDGET_ID, { pinned: true });
    ctx.layout.openPanel(FOCUS_CONTEXT_MAIN_WIDGET_ID);
    ctx.layout.openPanel(FOCUS_CONTEXT_PANEL_WIDGET_ID);
    ctx.layout.openPanel(FOCUS_CONTEXT_STATUS_WIDGET_ID, { pinned: true });
    ctx.focus.setActiveRegion("main");
  },
});
