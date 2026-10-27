import { HStack } from "@chakra-ui/react";
import { PaletteShortcut } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { NavigationTarget, WorkbenchCoreContributionContext } from "../../core";
import { getNavigationTargetKey } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { useShortcutCatalog } from "./use-shortcut-catalog";

interface ShortcutHintProps {
  workbench: WorkbenchCoreContributionContext;
  action?: NavigationTarget;
  children?: ReactNode;
  modeOnly?: boolean;
}

const ResolvedShortcutHint = (props: ShortcutHintProps) => {
  const { workbench, action, children } = props;
  const { hints } = useShortcutCatalog(workbench);
  const hint = action ? hints.get(getNavigationTargetKey(action)) : undefined;
  if (!hint) return children;
  return (
    <HStack gap="xs">
      {children}
      <PaletteShortcut binding={hint.split(" → ")} />
    </HStack>
  );
};

/** Hidden navigation hints must not resolve the whole catalog for every mounted tree row. */
export const WorkbenchShortcutHint = (props: ShortcutHintProps) => {
  const { workbench, action, children, modeOnly } = props;
  const active = useWorkbenchStore(workbench.keyboard.store, (state) => state.active);
  if (!action || (modeOnly && !active)) return children;
  return <ResolvedShortcutHint {...props} />;
};
