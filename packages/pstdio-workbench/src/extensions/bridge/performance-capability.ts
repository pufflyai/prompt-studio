import type {
  PerformanceDiagnosticsAdapter,
  PerformanceReadRequest,
} from "pstdio-api-contracts/performance-diagnostics";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";

const captures = new WeakMap<HostEventPublisher, () => Promise<void>>();
const subscriptions = new WeakMap<HostEventPublisher, () => void>();

const retainCapture = async (adapter: PerformanceDiagnosticsAdapter, events: HostEventPublisher) => {
  if (captures.has(events)) return;
  const retained = adapter.retain();
  let released = false;
  const dispose = async () => {
    if (released) return;
    released = true;
    disconnect();
    captures.delete(events);
    const release = await retained;
    await release();
  };
  const disconnect = events.onDisconnect(() => {
    void dispose().catch(() => {});
  });
  captures.set(events, dispose);
  try {
    await retained;
  } catch (error) {
    await dispose().catch(() => {});
    throw error;
  }
};

export const createPerformanceReadCapability = (
  adapter: PerformanceDiagnosticsAdapter | undefined,
  events?: HostEventPublisher,
) => {
  if (!adapter) return undefined;
  return async (request: PerformanceReadRequest) => {
    if (request.operation === "state") return adapter.state();
    if (request.operation === "recordings") return adapter.recordings();
    if (request.operation === "snapshot") return adapter.snapshot();
    if (!events) throw new Error("Performance subscriptions are unavailable in this host");
    if (request.operation === "dispose") {
      await captures.get(events)?.();
      return;
    }
    if (request.operation === "retain") {
      await retainCapture(adapter, events);
      return;
    }
    if (request.operation === "unsubscribe") {
      subscriptions.get(events)?.();
      return;
    }
    if (subscriptions.has(events)) return;
    const stop = adapter.subscribe((snapshot) => events.emit({ scope: "performance.read", payload: snapshot }));
    const disconnect = events.onDisconnect(() => dispose());
    const dispose = () => {
      stop();
      disconnect();
      subscriptions.delete(events);
    };
    subscriptions.set(events, dispose);
  };
};
