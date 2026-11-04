import type { SettingsChanges } from "@pstdio/ui";
import { createContext, type ReactNode, useContext, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { WorkbenchCore } from "../../core";
import { settingsLeaveGuard } from "./settings-leave-guard";

export const SettingsPageContext = createContext<{ workbench: WorkbenchCore; title: string } | null>(null);
export const SettingsHeaderContext = createContext<{ actions: HTMLElement | null; description: HTMLElement | null }>({
  actions: null,
  description: null,
});
/** Place view-specific controls and descriptive content in the fixed settings header. */
export const SettingsHeaderContent = (props: { children?: ReactNode; description?: ReactNode }) => {
  const targets = useContext(SettingsHeaderContext);
  return (
    <>
      {targets.actions && props.children ? createPortal(props.children, targets.actions) : null}
      {targets.description && props.description ? createPortal(props.description, targets.description) : null}
    </>
  );
};
/** Register staged changes with the settings header and navigation warning. Live forms omit this hook. */
export const useSettingsChanges = (changes: SettingsChanges | undefined) => {
  const page = useContext(SettingsPageContext);
  const latest = useRef(changes);
  useEffect(() => {
    latest.current = changes;
  });
  const registered = changes !== undefined;
  useEffect(() => {
    if (!page || !registered) return;
    return settingsLeaveGuard(page.workbench).register({
      title: page.title,
      get dirty() {
        return latest.current?.dirty ?? false;
      },
      get saving() {
        return latest.current?.saving;
      },
      get disabled() {
        return latest.current?.disabled;
      },
      save: async () => {
        if (latest.current?.disabled) throw new Error("Correct the invalid settings before saving.");
        await latest.current?.onSave();
      },
      reset: async () => {
        await latest.current?.onReset();
      },
    });
  }, [page, registered]);
  // Dirty and pending flags change through the registered getters; notify header subscribers after commit.
  // biome-ignore lint/correctness/useExhaustiveDependencies: These flags are the public snapshot of the registered draft.
  useEffect(() => {
    if (page) settingsLeaveGuard(page.workbench).changed();
  }, [page, changes?.dirty, changes?.saving, changes?.disabled]);
};
