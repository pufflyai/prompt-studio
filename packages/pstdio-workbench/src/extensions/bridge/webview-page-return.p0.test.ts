import { expect, test } from "bun:test";
import { modePanelFixture } from "../../core/controllers/page-runtime/mode-panel-state.fixture";
import { retainRecentViewPlacements } from "../../react/region/retained-view-lifetime";
import { getBridgeWebviewHostEventPublisher } from "./bridge-webview-renderer";
import { withFrameSignal } from "./webview-command-streams";

test("leaving a loading preview releases its cancelled view before returning", async () => {
  const { w, open, navigate } = modePanelFixture();
  open("loading-canvas", "main");
  const instance = w.layout.listPanelInstances("main").find((p) => p.resource?.id === "loading-canvas")!;
  const events = getBridgeWebviewHostEventPublisher(w, instance);
  events.bind(() => {});
  const loaded = Promise.withResolvers<void>();
  let signal!: AbortSignal;
  const pending = withFrameSignal(events, async (current) => {
    signal = current;
    await loaded.promise;
    current.throwIfAborted();
    return "ready";
  });
  const initial = {
    placements: [w.layout.getLayout().regions.main.widgets.find((p) => p.widgetId === instance.instanceId)!],
    expires: new Map<string, number>(),
  };
  navigate("alpha-list");
  loaded.resolve();
  try {
    expect(signal.aborted).toBe(true);
    const retained = retainRecentViewPlacements(initial, [], new Set(["document"]), new Set(), 0);
    expect(retained.placements).toEqual([]);
    open("loading-canvas", "main");
    const reopened = w.layout.listPanelInstances("main").find((p) => p.resource?.id === "loading-canvas")!;
    const nextEvents = getBridgeWebviewHostEventPublisher(w, reopened);
    expect(
      await withFrameSignal(nextEvents, async (current) => {
        current.throwIfAborted();
        return "ready";
      }),
    ).toBe("ready");
  } finally {
    await pending.catch(() => {});
    await w.dispose();
  }
});
