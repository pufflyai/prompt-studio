export const extensionsSource = `import {
  createWorkbenchCore,
  type Disposable,
  type WorkbenchModuleContribution,
} from "pstdio-workbench/core";

interface ExtensionDefinition {
  id: string;
  createModule: () => WorkbenchModuleContribution;
}

// An extension is just a workbench module. Enabling registers it; disabling
// disposes the registration, which removes every contribution it added.
export const createExtensionHost = (
  workbench: ReturnType<typeof createWorkbenchCore>,
  definitions: ExtensionDefinition[],
) => {
  const registrations = new Map<string, Disposable>();

  return {
    setEnabled(id: string, enabled: boolean) {
      const registration = registrations.get(id);

      if (enabled && !registration) {
        const definition = definitions.find((entry) => entry.id === id)!;
        registrations.set(id, workbench.registerModule(definition.createModule()));
      }

      if (!enabled && registration) {
        registration.dispose();
        registrations.delete(id);
      }
    },
  };
};`;
