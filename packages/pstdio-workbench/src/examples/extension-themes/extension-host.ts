import type { ThemePreferenceOption } from "@pstdio/ui";
import type { Disposable, WorkbenchCore, WorkbenchModuleContribution } from "../../core";

// An "extension" in this example is a workbench module that can be installed and
// removed while the workbench is running. Enabling registers the module;
// disabling disposes the registration, which removes every contribution the
// module added.
//
// Themes are a declarative contribution: the host registers a definition's
// `themes` into `workbench.themes` on enable and disposes them on disable —
// mirroring how an extension manifest declares `contributes.themes` rather than
// registering themes through activation code.
export interface ExtensionDefinition {
  id: string;
  name: string;
  description: string;
  contributes: string;
  icon: string;
  themes?: readonly ThemePreferenceOption[];
  createModule: () => WorkbenchModuleContribution;
}

export interface ExtensionHost {
  definitions: ExtensionDefinition[];
  getEnabledIds: () => string[];
  isEnabled: (id: string) => boolean;
  setEnabled: (id: string, enabled: boolean) => void;
  subscribe: (listener: () => void) => Disposable;
}

export const createExtensionHost = (workbench: WorkbenchCore, definitions: ExtensionDefinition[]): ExtensionHost => {
  const registrations = new Map<string, Disposable[]>();
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  return {
    definitions,
    getEnabledIds: () => [...registrations.keys()],
    isEnabled: (id) => registrations.has(id),

    setEnabled(id, enabled) {
      const registration = registrations.get(id);

      if (enabled && !registration) {
        const definition = definitions.find((entry) => entry.id === id)!;
        const disposables = [workbench.registerModule(definition.createModule())];
        if (definition.themes) disposables.push(workbench.themes.register(definition.themes));
        registrations.set(id, disposables);
        notify();
        return;
      }

      if (!enabled && registration) {
        for (const disposable of registration) disposable.dispose();
        registrations.delete(id);
        notify();
      }
    },

    subscribe(listener) {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
  };
};
