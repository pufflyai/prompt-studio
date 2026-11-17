import { Box, Flex, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import { useEffect, useId, useRef, useState } from "react";
import { createWorkbench, type ResourceRef, type WorkbenchCore, type WorkbenchRegion } from "../../core";
import { useTabContextMenu } from "../../react/region/use-tab-context-menu";
import { WorkbenchIcon } from "../../react/shared/icon";
import { Workbench } from "../../react/workbench/workbench";
import { RegionTabMenu } from "./region-tab-menu";

// PS-1128: each window is a full workbench for the same project. Moving a tab closes it in
// one window and opens it in the other. The window commands live in the tab menu. Both
// workbenches stay active: in production each window is its own document.

type WindowId = "main" | "second";
type NoteRegion = Extract<WorkbenchRegion, "main" | "side" | "secondary">;

interface Note {
  resource: ResourceRef;
  home: NoteRegion;
  body: string;
}

const notes: readonly Note[] = [
  {
    resource: { type: "note", id: "plan", label: "Launch plan" },
    home: "main",
    body: "Draft the launch checklist. Right-click this tab and choose Move to new window.",
  },
  {
    resource: { type: "note", id: "review", label: "Review notes" },
    home: "main",
    body: "A second Main tab, so the main window keeps a page after the plan moves.",
  },
  {
    resource: { type: "note", id: "inspector", label: "Inspector" },
    home: "side",
    body: "A Side panel tab. Moved alone, it fills the new window's Main area.",
  },
  {
    resource: { type: "note", id: "log", label: "Build log" },
    home: "secondary",
    body: "A Bottom panel tab, for watching output on a second screen.",
  },
];

const windowLabels: Record<WindowId, string> = { main: "Main window", second: "Window 2" };
const moveCommandId = "proposal.move-tab-to-window";
const placementId = (region: NoteRegion) => `proposal.notes.${region}`;

// Shared by both windows, so the tab menus follow whether Window 2 is open.
const createWindowState = () => {
  const listeners = new Set<() => void>();
  const state = {
    secondOpen: false,
    setSecondOpen(open: boolean) {
      state.secondOpen = open;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return state;
};

const moveRow = (id: string, label: string, icon: string, noteId: string | undefined, to: WindowId) => ({
  id,
  label,
  icon,
  action: { kind: "command" as const, commandId: moveCommandId, args: { noteId, to } },
});

const createWindowWorkbench = (windowId: WindowId, windowState: ReturnType<typeof createWindowState>) => {
  const workbench = createWorkbench({ regionSettings: { secondary: { alwaysShowTabs: true } } });
  workbench.resources.registerKind({ kind: "note", label: "Note" });
  workbench.views.registerView({
    id: "proposal.note",
    title: "Note",
    body: {
      kind: "react",
      render: ({ instance }) => (
        <Stack gap="sm" p="lg">
          <Text textStyle="heading/M">{instance.resource?.label}</Text>
          <Text color="fg.muted">{notes.find((note) => note.resource.id === instance.resource?.id)?.body}</Text>
        </Stack>
      ),
    },
  });
  for (const region of ["main", "side", "secondary"] as const) {
    workbench.shellPlacements.registerPlacement({
      id: placementId(region),
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", id: "note" }],
          view: { kind: "view", id: "proposal.note" },
          cardinality: "many",
        },
      },
      region,
      tab: {
        subscribe: windowState.subscribe,
        getSnapshot: (instance) => {
          const noteId = instance.resource?.id;
          let row = moveRow("to-main", "Move to Main window", "AppWindowMac", noteId, "main");
          if (windowId === "main") {
            row = windowState.secondOpen
              ? moveRow("to-second", "Move to Window 2", "AppWindowMac", noteId, "second")
              : moveRow("new-window", "Move to new window", "AppWindow", noteId, "second");
          }
          return { menu: [{ id: "window", label: "Window", rows: [row] }] };
        },
      },
    });
  }
  return workbench;
};

const WindowChrome = (props: {
  title: string;
  active: boolean;
  onClose?: () => void;
  onFocus: () => void;
  children: React.ReactNode;
}) => {
  const { title, active, onClose, onFocus, children } = props;
  return (
    <Stack
      flex="1"
      minW="0"
      gap="0"
      borderWidth="1px"
      borderColor={active ? "border.emphasized" : "border.subtle"}
      borderRadius="md"
      overflow="hidden"
      boxShadow={active ? "lg" : "sm"}
      onPointerDownCapture={onFocus}
    >
      <HStack h="8" px="sm" gap="sm" bg="bg.subtle" borderBottomWidth="1px" borderColor="border.subtle">
        <HStack gap="1.5" aria-hidden="true">
          {["#ff5f57", "#febc2e", "#28c840"].map((color) => (
            <Box key={color} boxSize="2.5" borderRadius="full" bg={active ? color : "border.emphasized"} />
          ))}
        </HStack>
        <Text flex="1" textAlign="center" textStyle="body/S" color={active ? "fg" : "fg.muted"} truncate>
          {title}
        </Text>
        {onClose ? (
          <IconButton aria-label={`Close ${title}`} size="2xs" variant="ghost" onClick={onClose}>
            <WorkbenchIcon name="X" size={12} />
          </IconButton>
        ) : (
          <Box w="5" />
        )}
      </HStack>
      <Box flex="1" minH="0">
        {children}
      </Box>
    </Stack>
  );
};

export const SeparateWindows = () => {
  const [windows, setWindows] = useState<Record<WindowId, WorkbenchCore> | undefined>();
  const [secondOpen, setSecondOpen] = useState(false);
  const [focused, setFocused] = useState<WindowId>("main");
  const [lastMove, setLastMove] = useState("Right-click a tab in the main window and choose Move to new window.");
  const openTabs = useRef(new Map<string, { windowId: WindowId; identity: PlacementIdentity }>());
  const secondWindowState = useRef<ReturnType<typeof createWindowState>>(undefined);

  useEffect(() => {
    const windowState = createWindowState();
    const created = {
      main: createWindowWorkbench("main", windowState),
      second: createWindowWorkbench("second", windowState),
    };
    secondWindowState.current = windowState;
    const tabs = openTabs.current;
    const open = (windowId: WindowId, note: Note, region: NoteRegion) => {
      const identity = created[windowId].shellPlacements.openPlacement({
        placementId: placementId(region),
        resource: note.resource,
        title: note.resource.label,
        open: "pin",
      });
      tabs.set(note.resource.id, { windowId, identity });
    };
    const move = (noteId: string, to: WindowId) => {
      const note = notes.find((candidate) => candidate.resource.id === noteId);
      const current = tabs.get(noteId);
      if (!note || !current || current.windowId === to) return;
      created[current.windowId].shellPlacements.closePlacement(current.identity);
      // A tab moved into Window 2 fills its Main area. Moving back restores its home panel.
      open(to, note, to === "main" ? note.home : "main");
      if (to === "second") {
        windowState.setSecondOpen(true);
        setSecondOpen(true);
      }
      setFocused(to);
      setLastMove(`${note.resource.label} moved to ${windowLabels[to]}.`);
    };
    for (const workbench of Object.values(created)) {
      workbench.commands.registerCommand(
        { id: moveCommandId, label: "Move tab to window" },
        {
          execute: (args) => {
            const { noteId, to } = args as { noteId: string; to: WindowId };
            move(noteId, to);
          },
        },
      );
    }
    for (const note of notes) open("main", note, note.home);
    setWindows(created);
    return () => {
      tabs.clear();
      for (const workbench of Object.values(created)) void workbench.dispose();
    };
  }, []);

  const closeSecondWindow = () => {
    if (!windows) return;
    // Closing a window keeps its tabs: they return to their panels in the main window.
    const moved = [...openTabs.current.entries()].filter(([, tab]) => tab.windowId === "second");
    for (const [noteId] of moved) void windows.second.commands.executeCommand(moveCommandId, { noteId, to: "main" });
    secondWindowState.current?.setSecondOpen(false);
    setSecondOpen(false);
    setFocused("main");
    setLastMove(
      moved.length
        ? `Window 2 closed. ${moved.length === 1 ? "Its tab" : `Its ${moved.length} tabs`} returned to the main window.`
        : "Window 2 closed.",
    );
  };

  if (!windows) return null;
  return (
    <Stack h="100dvh" gap="sm" p="md" bg="bg.muted">
      <Text role="status" textStyle="body/S" color="fg.muted">
        {lastMove}
      </Text>
      <Flex flex="1" minH="0" gap="md">
        <WindowChrome
          title="Prompt Studio — Launch site"
          active={focused === "main"}
          onFocus={() => setFocused("main")}
        >
          <Workbench workbench={windows.main} />
        </WindowChrome>
        <Box display={secondOpen ? "contents" : "none"}>
          <WindowChrome
            title="Launch site — Window 2"
            active={focused === "second"}
            onFocus={() => setFocused("second")}
            onClose={closeSecondWindow}
          >
            <Workbench workbench={windows.second} />
          </WindowChrome>
        </Box>
      </Flex>
    </Stack>
  );
};

const placementOptions = {
  main: { widgetId: "plan", contributionId: "proposal.notes.main", label: "Launch plan" },
  side: { widgetId: "inspector", contributionId: "proposal.notes.side", label: "Inspector" },
} as const;

export const TabMenu = (props: { tab: keyof typeof placementOptions; otherWindows: number }) => {
  const { tab, otherWindows } = props;
  const triggerId = useId();
  const { menu, show, onContextMenu } = useTabContextMenu(triggerId);
  const [workbench] = useState(() => createWorkbench());
  const [result, setResult] = useState("No action run");
  const option = placementOptions[tab];
  const windowTargets = Array.from({ length: otherWindows }, (_, index) => ({
    id: `window-${index + 1}`,
    label: index === 0 ? "Main window" : `Window ${index + 1}`,
  }));
  return (
    <Stack p="lg" gap="md" align="flex-start">
      <Text color="fg.muted" textStyle="body/S">
        Right-click the tab. Window actions get their own group at the top of the menu.
      </Text>
      <HStack
        id={triggerId}
        as="button"
        px="md"
        h="8"
        gap="sm"
        borderWidth="1px"
        borderColor="border.subtle"
        borderRadius="sm"
        onClick={(event) => show(event.currentTarget)}
        onContextMenu={onContextMenu}
      >
        <WorkbenchIcon name="FileText" size={14} />
        <Text textStyle="body/S">{option.label}</Text>
      </HStack>
      <Text role="status" textStyle="body/S">
        {result}
      </Text>
      <RegionTabMenu
        menu={menu}
        label={option.label}
        workbench={workbench}
        groups={[]}
        placement={{
          widgetId: option.widgetId,
          contributionId: option.contributionId,
          resource: { type: "note", id: option.widgetId, label: option.label },
          closable: true,
        }}
        windows={windowTargets}
        onMoveToNewWindow={() => setResult(`${option.label} moved to a new window`)}
        onMoveToWindow={(id) =>
          setResult(`${option.label} moved to ${windowTargets.find((target) => target.id === id)?.label}`)
        }
      />
    </Stack>
  );
};
