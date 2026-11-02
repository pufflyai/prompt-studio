import { createWorkbench } from "@pstdio/workbench";
import { getBridgeWebviewHostEventPublisher, renderBridgeWebviewFrame } from "@pstdio/workbench/extensions";
import {
  createWorkbenchSettingsModule,
  WORKBENCH_SETTINGS_OPEN_COMMAND_ID,
  Workbench,
  WorkbenchThemeProvider,
} from "@pstdio/workbench/react";
import type { PerformanceDiagnosticsAdapter } from "pstdio-api-contracts/performance-diagnostics";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const workbench = createWorkbench();
const stats = { retained: 0, released: 0, subscriptions: 0 };
let retainedRequest: unknown;
window.addEventListener("message", (event) => {
  if (event.data?.action === "lifetime-replay-observed") {
    document.querySelector("#replayed")!.textContent = JSON.stringify(stats);
    return;
  }
  const frame = document.querySelector<HTMLIFrameElement>('iframe[title="First"]');
  if (
    frame?.contentWindow === event.source &&
    event.data?.action === "RIMLESS/RPC_REQUEST" &&
    event.data.callName === "call" &&
    event.data.args?.[0]?.method === "performance.read" &&
    event.data.args[0].params?.operation === "retain"
  )
    retainedRequest = event.data;
});
const update = () => {
  document.querySelector("#ownership")!.textContent = JSON.stringify(stats);
};
const listeners = new Set<(snapshot: null) => void>();
const performance = {
  state: async () => ({ enabled: false, host: "browser" }),
  recordings: async () => null,
  snapshot: async () => null,
  control: async () => {},
  retain: async () => {
    stats.retained++;
    update();
    return async () => {
      stats.released++;
      update();
    };
  },
  subscribe: (listener) => {
    listeners.add(listener);
    stats.subscriptions = listeners.size;
    update();
    return () => {
      listeners.delete(listener);
      stats.subscriptions = listeners.size;
      update();
    };
  },
} satisfies PerformanceDiagnosticsAdapter;

workbench.registerModule(createWorkbenchSettingsModule());
workbench.registerModule({
  id: "lifetime-fixture",
  activate(ctx) {
    const children = ["First", "Second"].map((title) => {
      ctx.views.registerView({
        id: title,
        title,
        body: {
          kind: "react",
          render: (input) =>
            renderBridgeWebviewFrame({
              context: {
                workbench,
                placement: input.instance,
                webviewId: title,
                hostEvents: getBridgeWebviewHostEventPublisher(workbench, input.instance),
              },
              title,
              webview: {
                runtimeUrl: "http://lifetime-fixture.test/runtime",
                moduleUrl: "http://lifetime-fixture.test/guest.js",
                capabilities: ["performance.read"],
              },
              createProps: () => ({}),
              createHostAdapters: ({ hostEvents }) => ({ hostEvents, performance }),
            }),
        },
      });
      return ctx.settings.registerPanel({
        id: title,
        title,
        viewId: title,
        kind: "view",
        parentPanelId: "controls",
        scope: "global",
      });
    });
    ctx.views.registerView({
      id: "controls",
      title: "Controls",
      body: { kind: "react", render: () => <button onClick={() => children[0]!.dispose()}>Remove First</button> },
    });
    ctx.settings.registerPanel({
      id: "controls",
      title: "Controls",
      viewId: "controls",
      kind: "view",
      scope: "global",
    });
  },
});
const root = createRoot(document.querySelector("#app")!);
root.render(
  <StrictMode>
    <WorkbenchThemeProvider>
      <Workbench workbench={workbench} />
    </WorkbenchThemeProvider>
  </StrictMode>,
);
void workbench.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID);
document.querySelector("#close")!.addEventListener("click", () => root.unmount());
document.querySelector("#emit")!.addEventListener("click", () => {
  for (const listener of listeners) listener(null);
});
document.querySelector("#replay")!.addEventListener("click", () => {
  if (!retainedRequest) throw new Error("The live guest did not make its retain request");
  window.postMessage(retainedRequest, location.origin);
  // Messages from this source are ordered. Observe after the replay reached its old listener.
  window.postMessage({ action: "lifetime-replay-observed" }, location.origin);
});
update();
