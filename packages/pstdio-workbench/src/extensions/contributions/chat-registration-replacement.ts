import type { WorkbenchPanelRenderInput } from "../../core";
import { getWorkbenchQueries } from "../../core/workbench-queries";
import type { RegisterWorkbenchExtensionContributionsInput } from "../host/workbench-extension-host-types";
import type { createChatRendererBindings } from "./chat-renderer-bindings";
import type { ChatSession } from "./chat-session";

interface Binding {
  render: WorkbenchPanelRenderInput;
  registration: RegisterWorkbenchExtensionContributionsInput;
  session: ChatSession;
  bindings?: ReturnType<typeof createChatRendererBindings>;
}

/** Only synchronous registration replacement may bridge an unchanged source's observation. */
export const createChatRegistrationReplacement = (sessions: () => Iterable<Binding>) => {
  let replacing = 0;
  const detached = new Set<object>();
  const detach = (token: object) => {
    for (const owner of sessions()) owner.bindings?.detach(token);
  };
  return {
    preserve() {
      replacing++;
      return () => {
        if (--replacing) return;
        const tokens = [...detached];
        detached.clear();
        for (const token of tokens) detach(token);
      };
    },
    attach(nextInput: RegisterWorkbenchExtensionContributionsInput, token: object) {
      if (!replacing) return;
      for (const owner of sessions()) {
        const core = owner.render.workbench;
        const previousRoot = owner.registration.queries ?? getWorkbenchQueries(core);
        const nextRoot = nextInput.queries ?? getWorkbenchQueries(core);
        if (
          core.views.store === nextInput.workbench.views.store &&
          previousRoot === nextRoot &&
          !owner.session.query.isDisposed()
        )
          owner.bindings?.attach(owner.render, nextInput, token);
      }
    },
    detach(token: object) {
      if (replacing) detached.add(token);
      else detach(token);
    },
  };
};
