import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ListRow, PaletteShortcut } from "@pstdio/ui";
import { getKeybindingSteps, type WorkbenchCore } from "@pstdio/workbench";
import { useShortcutCatalog, WorkbenchShortcutKeys } from "@pstdio/workbench/react";
import { dashboardCommandIds } from "@/shared/app/commands";
import type { DashboardExtensionMetadata } from "@/shared/extensions/types";

const EffectiveShortcuts = (props: { workbench: WorkbenchCore; extensionId: string }) => {
  const { workbench, extensionId } = props;
  const { catalog } = useShortcutCatalog(workbench);
  const openingChord = getKeybindingSteps(
    catalog.find((entry) => entry.id === "workbench.keyboard.leader")?.binding.keybinding ?? "",
  ).join(" ");
  const shortcuts = catalog.filter((shortcut) => shortcut.binding.sourceExtensionId === extensionId);
  return (
    <Stack gap="0">
      {shortcuts.map((shortcut) => (
        <ListRow
          key={shortcut.id}
          variant="full-width"
          label={shortcut.label}
          description={`${shortcut.binding.targetScope ?? "project"}${shortcut.binding.sticky ? " · Sticky" : ""}${shortcut.disabled ? " · Inactive" : ""}`}
          endContent={<WorkbenchShortcutKeys shortcut={shortcut} openingChord={openingChord} catalog={catalog} />}
        />
      ))}
      <Button
        alignSelf="start"
        size="sm"
        variant="ghost"
        onClick={() => void workbench.commands.executeCommand(dashboardCommandIds.openShortcuts, { extensionId })}
      >
        View all shortcuts
      </Button>
    </Stack>
  );
};

export const ExtensionShortcutContributions = (props: {
  workbench?: WorkbenchCore;
  metadata: DashboardExtensionMetadata | undefined;
  extensionId: string;
}) => {
  const { workbench, metadata, extensionId } = props;
  const declared = metadata?.keybindings?.filter((record) => record.extensionId === extensionId) ?? [];
  if (!declared.length && !workbench) return null;
  return (
    <Stack gap="xs" pt="md">
      <Text textStyle="label/XS/medium" color="fg.muted">
        Keyboard shortcuts
      </Text>
      {!workbench
        ? declared.map((record) => (
            <ListRow
              key={record.id}
              variant="full-width"
              label={record.id}
              description={`${record.layer ?? "Direct"} · ${record.targetScope ?? "project"}${record.sticky ? " · Sticky" : ""}`}
              endContent={
                <HStack gap="xs">
                  <PaletteShortcut binding={record.key} />
                  {Object.entries(record.platformOverrides ?? {}).map(([platform, key]) => (
                    <Text key={platform} textStyle="label/XS/regular">
                      {platform}: {key}
                    </Text>
                  ))}
                </HStack>
              }
            />
          ))
        : null}
      {workbench ? <EffectiveShortcuts workbench={workbench} extensionId={extensionId} /> : null}
    </Stack>
  );
};
