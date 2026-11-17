import { HStack } from "@chakra-ui/react";
import { PaletteShortcut } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { NavigationTarget, WorkbenchCoreContributionContext } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { useActionShortcutHint } from "./use-action-shortcut-hint";

interface ShortcutHintProps {
  workbench: WorkbenchCoreContributionContext;
  action?: NavigationTarget;
  children?: ReactNode;
  modeOnly?: boolean;
}

const ResolvedShortcutHint = (props: ShortcutHintProps) => {
  const { workbench, action, children } = props;
  const hint = useActionShortcutHint(workbench, action);
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
  const visible = useWorkbenchStore(workbench.keyboard.store, (state) => state.active || state.preview);
  if (!action || (modeOnly && !visible)) return children;
  return <ResolvedShortcutHint {...props} />;
};
