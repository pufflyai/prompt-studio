import { useEffect, useRef } from "react";
import type { Disposable, WorkbenchCore, WorkbenchModuleContribution } from "../../core";

export interface WorkbenchModuleHostRegistration {
  disposable: Disposable;
}

export interface WorkbenchModuleHostProps {
  workbench: WorkbenchCore;
  modules: readonly WorkbenchModuleContribution[];
}

export const disposeWorkbenchModuleHostRegistrations = (
  registrations: Map<string, WorkbenchModuleHostRegistration>,
) => {
  for (const registration of registrations.values()) registration.disposable.dispose();
  registrations.clear();
};

export const syncWorkbenchModuleHostRegistrations = (
  workbench: WorkbenchCore,
  registrations: Map<string, WorkbenchModuleHostRegistration>,
  modules: readonly WorkbenchModuleContribution[],
) => {
  const moduleIds = new Set(modules.map((module) => module.id));

  for (const [id, registration] of registrations) {
    if (!moduleIds.has(id)) {
      registration.disposable.dispose();
      registrations.delete(id);
    }
  }

  for (const module of modules) {
    if (!registrations.has(module.id)) {
      registrations.set(module.id, { disposable: workbench.registerModule(module) });
    }
  }
};

export const WorkbenchModuleHost = (props: WorkbenchModuleHostProps) => {
  const { workbench, modules } = props;
  const registeredWorkbench = useRef(workbench);
  const registrations = useRef(new Map<string, WorkbenchModuleHostRegistration>());

  useEffect(() => {
    if (registeredWorkbench.current !== workbench) {
      disposeWorkbenchModuleHostRegistrations(registrations.current);
      registeredWorkbench.current = workbench;
    }

    syncWorkbenchModuleHostRegistrations(workbench, registrations.current, modules);
  }, [modules, workbench]);

  useEffect(() => () => disposeWorkbenchModuleHostRegistrations(registrations.current), []);

  return null;
};
