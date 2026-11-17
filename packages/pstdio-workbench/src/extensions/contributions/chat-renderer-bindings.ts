import { getWorkbenchRenderers, type WorkbenchPanelRenderInput } from "../../core";
import { rendererRefreshKey } from "../../core/registries/renderers/renderer-refresh-key";
import { registerWorkbenchRequiredWork } from "../../core/workbench-required-work";
import type { RegisterWorkbenchExtensionContributionsInput } from "../host/workbench-extension-host-types";
import type { ChatSession } from "./chat-session";

/** Registrations detach their own observation; a peer core can still present the shared session. */
export const createChatRendererBindings = (input: {
  session: ChatSession;
  viewId: string;
  isSource(render: WorkbenchPanelRenderInput): boolean;
  select(render: WorkbenchPanelRenderInput, registration: RegisterWorkbenchExtensionContributionsInput): void;
}) => {
  const bindings = new Map<
    object,
    {
      render: WorkbenchPanelRenderInput;
      registration: RegisterWorkbenchExtensionContributionsInput;
      stopRefresh(): void;
      stopClose(): void;
    }
  >();
  let current: object | undefined;
  let disposing = false;
  const detach = (token: object) => {
    const binding = bindings.get(token);
    if (!binding) return;
    bindings.delete(token);
    binding.stopRefresh();
    binding.stopClose();
    const wasCurrent = current === token;
    const sourceRetired =
      input.isSource(binding.render) &&
      ![...bindings.values()].some((other) => other.render.workbench === binding.render.workbench);
    if (wasCurrent) {
      const replacement = [...bindings].at(-1);
      current = replacement?.[0];
      if (replacement) {
        input.select(replacement[1].render, replacement[1].registration);
      }
    }
    if (!bindings.size) input.session.suspend();
    else if ((wasCurrent || sourceRetired) && !disposing) input.session.rebind();
  };
  return {
    attach(
      render: WorkbenchPanelRenderInput,
      registration: RegisterWorkbenchExtensionContributionsInput,
      token: object,
    ) {
      current = token;
      input.select(render, registration);
      const existing = bindings.get(token);
      if (existing) {
        existing.render = render;
        existing.registration = registration;
        return;
      }
      const stopRefresh = getWorkbenchRenderers(render.workbench).store.subscribeSelector(
        (state) => rendererRefreshKey(state.refreshKeys, input.viewId, render.instance.resource),
        () => input.session.reconnect(),
      );
      const stopClose = registerWorkbenchRequiredWork(render.workbench, () => detach(token));
      bindings.set(token, { render, registration, stopRefresh, stopClose });
    },
    detach,
    dispose() {
      disposing = true;
      for (const token of [...bindings.keys()]) detach(token);
    },
  };
};
