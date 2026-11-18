import type { RendererContext } from "@pstdio/sdk/extensions";
import { text } from "pstdio-extensions/workbench";
import { WorkbenchActionBar } from "../../react/action-bar/action-bar";
import { executeWorkbenchExtensionCommand } from "../host/workbench-extension-command";
import type { RegisterWorkbenchExtensionContributionsInput } from "../host/workbench-extension-host-types";
import { toActionBarSnapshot } from "./action-bar-snapshot";

export const registerWorkbenchExtensionActionBars = (input: RegisterWorkbenchExtensionContributionsInput) => {
  const registrations = input.metadata.views.flatMap((view) => {
    const body = view.body;
    if (body.kind !== "actionBar") return [];
    const ownerId = crypto.randomUUID();
    const lifetime = new AbortController();
    const load = async (renderer: RendererContext, signal: AbortSignal) =>
      toActionBarSnapshot(
        await executeWorkbenchExtensionCommand(input, body.queryHandlerId, {
          signal: AbortSignal.any([signal, lifetime.signal]),
          resource: renderer.resource,
          params: { renderer },
        }),
        view.extensionId,
        input.projectId,
      );
    const registration = input.workbench.views.registerView(
      {
        id: view.id,
        title: text(view.title, view.id),
        icon: view.icon,
        body: {
          kind: "react",
          render: (render) => (
            <WorkbenchActionBar
              key={ownerId}
              ownerId={ownerId}
              lifetime={lifetime.signal}
              render={render}
              viewId={view.id}
              title={text(view.title, view.id)}
              projectId={input.projectId}
              extensionId={view.extensionId}
              orientation={body.orientation}
              refreshEvents={body.refreshEventIds}
              load={load}
            />
          ),
        },
      },
      { ownerId: view.extensionId, source: "extension" },
    );
    return [
      {
        dispose() {
          lifetime.abort();
          registration.dispose();
        },
      },
    ];
  });
  return {
    dispose: () => {
      for (const registration of registrations.reverse()) registration.dispose();
    },
  };
};
