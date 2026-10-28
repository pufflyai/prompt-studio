import { Box, Image } from "@chakra-ui/react";
import { PaletteShortcut, Tooltip, type TreeListActionMenuItem } from "@pstdio/ui";
import type { KeybindingSequence, WorkbenchCoreContributionContext } from "../../core";
import { reportUserActionError } from "../../core/shared/run-user-action";
import { WorkbenchShortcutHint } from "../keybindings/shortcut-hint";
import { WorkbenchIcon } from "../shared/icon";
import { type MenuEntry, type ResolveMenuEntriesInput, resolveMenuEntries, withLeadingSeparator } from "./menu-entries";
export interface CreateMenuItemsInput extends ResolveMenuEntriesInput {
  onCommandError?: (error: unknown) => void;
}

const createMenuIcon = (input: { icon?: string; iconSrc?: string }) => {
  const { icon, iconSrc } = input;
  if (iconSrc) {
    return (
      <Box boxSize="16px" bg="white" borderRadius="4px" p="1px" display="grid" placeItems="center">
        <Image
          src={iconSrc}
          alt=""
          aria-hidden="true"
          htmlWidth={14}
          htmlHeight={14}
          display="block"
          w="full"
          h="full"
          fit="contain"
        />
      </Box>
    );
  }

  return icon ? <WorkbenchIcon name={icon} /> : undefined;
};

export const createMenuEndContent = (input: {
  external?: boolean;
  binding?: KeybindingSequence;
  disabledReason?: string;
  readOnly?: boolean;
}) => {
  const { binding, external, disabledReason, readOnly } = input;
  if (readOnly && disabledReason)
    return (
      <Tooltip content={disabledReason}>
        <Box as="span" tabIndex={0} aria-label={disabledReason}>
          <WorkbenchIcon name="Info" />
        </Box>
      </Tooltip>
    );
  if (external) return <WorkbenchIcon name="ArrowUpRight" size={14} color="fg.muted" />;
  if (binding) return <PaletteShortcut binding={binding} />;
  return undefined;
};

const toMenuItem = (
  workbench: WorkbenchCoreContributionContext,
  entry: MenuEntry,
  onCommandError: CreateMenuItemsInput["onCommandError"],
): TreeListActionMenuItem => ({
  id: entry.id,
  label: entry.label,
  group: entry.group,
  commandId: entry.commandId,
  description: entry.description,
  icon: createMenuIcon(entry),
  endContent: (
    <WorkbenchShortcutHint workbench={workbench} action={entry.action}>
      {createMenuEndContent({
        external: entry.external,
        disabledReason: entry.description,
        readOnly: entry.readOnly,
      })}
    </WorkbenchShortcutHint>
  ),
  disabled: entry.disabled,
  readOnly: entry.readOnly,
  separatorBefore: entry.separatorBefore,
  onAction: entry.run
    ? () => {
        void entry.run?.().catch((error) => {
          if (onCommandError) onCommandError(error);
          else reportUserActionError(workbench, entry.label, error);
        });
      }
    : undefined,
});

export const createMenuItemGroups = (input: CreateMenuItemsInput) => {
  const entries = resolveMenuEntries(input);
  const itemsWhere = (kernel: boolean) =>
    entries
      .filter((entry) => entry.kernel === kernel)
      .map((entry) => toMenuItem(input.workbench, entry, input.onCommandError));
  return { regularItems: itemsWhere(false), kernelItems: itemsWhere(true) };
};

export const createMenuItems = (input: CreateMenuItemsInput) => {
  const { regularItems, kernelItems } = createMenuItemGroups(input);
  return [...regularItems, ...withLeadingSeparator(kernelItems, regularItems.length > 0)];
};
