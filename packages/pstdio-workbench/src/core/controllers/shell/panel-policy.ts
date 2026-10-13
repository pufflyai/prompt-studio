import type { WorkbenchRegionSettings, WorkbenchRegionState } from "../../registries/layout/layout-types";

interface PanelPolicyInput {
  provided: boolean;
  settings?: WorkbenchRegionSettings;
  tabCount: number;
  visibility?: WorkbenchRegionState["visibility"];
  headerVisible?: boolean;
  authoredOpen?: boolean;
  main?: boolean;
  legacyVisible?: boolean;
  legacyHeaders?: boolean;
  supportsFloating?: boolean;
  legacyFloatable?: boolean;
  floatingBubble?: boolean;
}

const panelCapabilities = (input: PanelPolicyInput) => {
  const settings = input.settings ?? {};
  const canOpen = input.provided && settings.canOpen !== false;
  const canClose = input.provided && !input.main && settings.canClose !== false;
  const size = settings.size;
  const fixedSize = size?.minPx !== undefined && size.minPx === size.maxPx;
  return {
    canOpen,
    canClose,
    canToggle: canOpen && canClose,
    acceptsTabs: input.provided && settings.acceptsTabs !== false,
    resizable: input.provided && !fixedSize && settings.resizable !== false,
    movable: input.provided && settings.movable !== false,
    floatable:
      input.provided && input.supportsFloating === true && (settings.floatable ?? input.legacyFloatable ?? true),
  };
};

const panelOpen = (input: PanelPolicyInput, capabilities: ReturnType<typeof panelCapabilities>) => {
  if (!input.provided) return false;
  if (input.main) return true;
  if (input.legacyVisible !== undefined) return input.legacyVisible;
  const visibility = input.visibility ?? "auto";
  if (!capabilities.canOpen) return (input.authoredOpen ?? true) && (!capabilities.canClose || visibility !== "closed");
  return visibility !== "closed" && (visibility === "open" || input.tabCount > 0);
};

/** Resolve capabilities separately. A visible header grants no panel permission. */
export const resolvePanelPolicy = (input: PanelPolicyInput) => {
  const capabilities = panelCapabilities(input);
  return {
    ...capabilities,
    provided: input.provided,
    open: panelOpen(input, capabilities),
    floatingBubble: input.provided && input.floatingBubble !== false,
    showHeader: input.provided && (input.headerVisible ?? input.settings?.showHeader ?? true),
    legacyHeaders: input.headerVisible === undefined && (input.legacyHeaders ?? false),
    defaultTab: input.settings?.defaultTab,
  };
};

export type WorkbenchPanelPolicy = ReturnType<typeof resolvePanelPolicy>;
