import { Button, Dialog, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { ListRow, PaletteShortcut, ScrollArea, SegmentedControl } from "@pstdio/ui";
import { useHotkeyRecorder } from "@tanstack/react-hotkeys";
import { findReservedKeybindingConflicts } from "pstdio-extensions/workbench";
import { useEffect, useState } from "react";
import type { WorkbenchCore } from "../../core";
import type { ResolvedShortcut } from "../../core/controllers/keyboard/shortcut-catalog";
import { getKeybindingSteps } from "../../core/registries/keybindings/keybinding-registry";
import { type ShortcutAssignment, shortcutLayers } from "../../core/registries/keybindings/shortcut-preferences";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { useShortcutCatalog } from "./use-shortcut-catalog";

const AssignmentEditor = (props: { workbench: WorkbenchCore; shortcut: ResolvedShortcut; close(): void }) => {
  const { workbench, shortcut, close } = props;
  const [key, setKey] = useState(getKeybindingSteps(shortcut.binding.keybinding).join(" "));
  const [layer, setLayer] = useState<NonNullable<ShortcutAssignment["layer"]>>(shortcut.binding.layer ?? "direct");
  const [error, setError] = useState("");
  const recorder = useHotkeyRecorder({ onRecord: (hotkey) => setKey(hotkey) });
  const warnings =
    layer === "direct"
      ? getKeybindingSteps(key).flatMap((chord) =>
          findReservedKeybindingConflicts({ mac: chord, linux: chord, win: chord }),
        )
      : [];
  return (
    <Stack gap="xs" p="sm" borderBottomWidth="1px" borderColor="border.subtle">
      <Text textStyle="label/S/medium">{shortcut.label}</Text>
      <SegmentedControl
        size="sm"
        value={layer}
        onValueChange={(value) => setLayer(value as typeof layer)}
        options={[
          { label: "Direct", value: "direct" },
          ...Object.keys(shortcutLayers).map((value) => ({ value, label: value })),
        ]}
      />
      {layer === "direct" ? (
        <Button size="sm" variant="ghost" onClick={recorder.startRecording}>
          {recorder.isRecording ? "Press shortcut…" : "Record shortcut"}
        </Button>
      ) : null}
      <Input
        aria-label="Shortcut keys"
        size="sm"
        value={key}
        onChange={(event) => setKey(event.target.value)}
        placeholder={layer === "direct" ? "Mod+Shift+K" : "K or K S"}
      />
      {warnings.length ? (
        <Text textStyle="label/XS/regular" color="fg.muted">
          May be reserved:{" "}
          {[...new Set(warnings.map((warning) => `${warning.platform}: ${warning.description}`))].join("; ")}
        </Text>
      ) : null}
      {error ? (
        <Text role="alert" color="fg.error" textStyle="label/XS/regular">
          {error}
        </Text>
      ) : null}
      <HStack>
        <Button
          size="sm"
          onClick={async () => {
            try {
              await workbench.keyboard.setAssignment(shortcut.id, { keybinding: key, layer, disabled: false });
              close();
            } catch (error) {
              setError(error instanceof Error ? error.message : String(error));
            }
          }}
        >
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={close}>
          Cancel
        </Button>
      </HStack>
    </Stack>
  );
};

const ExtensionAlias = (props: { workbench: WorkbenchCore; extensionId: string }) => {
  const { workbench, extensionId } = props;
  const [alias, setAlias] = useState(workbench.keyboard.getAlias(extensionId) ?? "");
  const [error, setError] = useState("");
  return (
    <HStack gap="xs">
      <Text textStyle="label/XS/regular" flex="1">
        {extensionId}
      </Text>
      <Input
        size="sm"
        aria-label={`Alias for ${extensionId}`}
        placeholder="Pin alias"
        value={alias}
        onChange={(event) => setAlias(event.target.value)}
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={async () => {
          try {
            await workbench.keyboard.setAlias(extensionId, alias);
            setError("");
          } catch (error) {
            setError(String(error));
          }
        }}
      >
        Pin
      </Button>
      {workbench.keyboard.getAlias(extensionId) ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            await workbench.keyboard.setAlias(extensionId, "");
            setAlias("");
          }}
        >
          Unpin
        </Button>
      ) : null}
      {error ? <Text role="alert">{error}</Text> : null}
    </HStack>
  );
};

const ShortcutRow = (props: {
  workbench: WorkbenchCore;
  shortcut: ResolvedShortcut;
  editing: boolean;
  ownerLabels: Record<string, string>;
  shared: boolean;
  edit(): void;
  close(): void;
}) => {
  const { workbench, shortcut, editing, edit, close, ownerLabels, shared } = props;
  const declared = workbench.keybindings
    .listCatalog()
    .find((binding) => workbench.keybindings.getId(binding) === shortcut.id);
  const assigned = getKeybindingSteps(shortcut.binding.keybinding).length > 0;
  const override = workbench.keyboard.getAssignment(shortcut.id);
  let status = "Assigned";
  if (shortcut.disabled) status = "Inactive";
  if (!assigned) status = "Unassigned";
  if (override?.disabled) status = "Disabled";
  return (
    <Stack key={shortcut.id} gap="0" role="group" aria-label={shortcut.label}>
      <ListRow
        variant="full-width"
        label={shortcut.label}
        description={`${ownerLabels[shortcut.binding.sourceExtensionId ?? ""] ?? shortcut.binding.sourceExtensionId ?? "Core"} · ${shortcut.binding.layer ?? "Direct"} · ${status}${shortcut.binding.sticky ? " · Sticky" : ""} · ${shortcut.binding.targetScope ?? "project"}${shared ? " · Shared key: choose action or target" : ""}${override ? ` · Default: ${getKeybindingSteps(declared?.keybinding ?? "").join(" ") || "Unassigned"}` : ""}${shortcut.binding.when ? ` · ${shortcut.binding.when}` : ""}`}
        endContent={
          <HStack gap="2xs">
            {assigned ? (
              <PaletteShortcut
                binding={shortcut.binding.layer ? ["Leader", ...shortcut.keys] : shortcut.binding.keybinding}
              />
            ) : null}
            <Button size="xs" variant="ghost" aria-label={`Rebind ${shortcut.label}`} onClick={edit}>
              Rebind
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() =>
                void workbench.keyboard.setAssignment(shortcut.id, {
                  ...override,
                  disabled: !override?.disabled,
                })
              }
            >
              {override?.disabled ? "Enable" : "Disable"}
            </Button>
            {override ? (
              <Button size="xs" variant="ghost" onClick={() => void workbench.keyboard.resetAssignment(shortcut.id)}>
                Reset
              </Button>
            ) : null}
          </HStack>
        }
      />
      {editing ? <AssignmentEditor workbench={workbench} shortcut={shortcut} close={close} /> : null}
    </Stack>
  );
};

interface KeyboardShortcutsPanelProps {
  workbench: WorkbenchCore;
  initialFilter?: string;
  ownerLabels?: Record<string, string>;
}

export const WorkbenchKeyboardShortcutsPanel = (props: KeyboardShortcutsPanelProps) => {
  const { workbench, initialFilter = "", ownerLabels = {} } = props;
  const [query, setQuery] = useState(initialFilter);
  const [editing, setEditing] = useState<string>();
  useWorkbenchStore(workbench.keybindings.store, (state) => state.keybindings);
  useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  useWorkbenchStore(workbench.context.store, (state) => state);
  useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  useWorkbenchStore(workbench.keyboard.store, (state) => state);
  const [, setRevision] = useState(0);
  useEffect(() => {
    const listener = workbench.preferences.onDidChangeValue(() => setRevision((value) => value + 1));
    return () => listener.dispose();
  }, [workbench]);
  const { catalog } = useShortcutCatalog(workbench);
  const filtered = catalog.filter((shortcut) =>
    `${shortcut.label} ${shortcut.id} ${ownerLabels[shortcut.binding.sourceExtensionId ?? ""] ?? shortcut.binding.sourceExtensionId ?? "Core"} ${shortcut.keys.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const extensions = [
    ...new Set(
      catalog.flatMap((shortcut) => (shortcut.binding.sourceExtensionId ? [shortcut.binding.sourceExtensionId] : [])),
    ),
  ];
  return (
    <Stack gap="0" minW="0">
      <Dialog.Header>
        <Text textStyle="heading/S">Keyboard shortcuts</Text>
      </Dialog.Header>
      <Input
        aria-label="Search keyboard shortcuts"
        placeholder="Search action, extension, or keys"
        size="sm"
        variant="borderless"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <Dialog.Body p="0">
        <ScrollArea maxH="palette-results-height" showHorizontalScrollbar={false}>
          {filtered.map((shortcut) => (
            <ShortcutRow
              key={shortcut.id}
              workbench={workbench}
              shortcut={shortcut}
              ownerLabels={ownerLabels}
              shared={Boolean(
                shortcut.binding.layer &&
                  catalog.some(
                    (candidate) => candidate.id !== shortcut.id && candidate.keys.join(" ") === shortcut.keys.join(" "),
                  ),
              )}
              editing={editing === shortcut.id}
              edit={() => setEditing(shortcut.id)}
              close={() => setEditing(undefined)}
            />
          ))}
          {extensions
            .filter((id) => id.toLowerCase().includes(query.toLowerCase()))
            .map((extensionId) => (
              <ExtensionAlias key={extensionId} workbench={workbench} extensionId={extensionId} />
            ))}
        </ScrollArea>
      </Dialog.Body>
    </Stack>
  );
};
