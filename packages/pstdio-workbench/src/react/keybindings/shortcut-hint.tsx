import { HStack } from "@chakra-ui/react";
import { PaletteShortcut } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { NavigationTarget, WorkbenchCoreContributionContext } from "../../core";
import { getNavigationTargetKey } from "../../core";
import { useShortcutCatalog } from "./use-shortcut-catalog";

/** A mounted row resolves its hint; adapting a large tree does no catalog work. */
export const WorkbenchShortcutHint = (props: {
  workbench: WorkbenchCoreContributionContext;
  action?: NavigationTarget;
  children?: ReactNode;
  modeOnly?: boolean;
}) => {
  const { workbench, action, children, modeOnly } = props;
  const { state, hints } = useShortcutCatalog(workbench);
  const hint = action && (!modeOnly || state.active) ? hints.get(getNavigationTargetKey(action)) : undefined;
  if (!hint) return children;
  return (
    <HStack gap="xs">
      {children}
      <PaletteShortcut binding={hint} />
    </HStack>
  );
};
