import type { WebviewCommandQuery } from "@pstdio/sdk/extensions";
import type { AutoBuildMode } from "../../data/auto-build-mode";
import type { PlanClient } from "./use-plan";

type Value = Awaited<ReturnType<PlanClient["commands"]["auto-build.read"]>>;
const configuration = (value: AutoBuildMode | undefined) =>
  value && {
    revision: value.revision,
    enabled: value.enabled,
    state: value.state ?? (value.enabled ? "running" : "stopped"),
    prompt: value.prompt,
    supervisorModel: value.supervisorModel,
    blockOnReview: value.blockOnReview,
    eligible: value.eligible,
    requireMergedDependencies: value.requireMergedDependencies,
  };

/** Only the acknowledged configuration is local; sessions/capacity stay in the canonical host read. */
export const createAutoBuildProjection = (query: WebviewCommandQuery<Value>) => {
  let generation = 0;
  let configurationVersion = 0;
  let key = JSON.stringify(configuration(query.getSnapshot().data));
  let overlay: { action: number; version: number; saved: AutoBuildMode } | undefined;
  let source = query.getSnapshot();
  let snapshot = source;
  let appliedOverlay = overlay;
  const listeners = new Set<() => void>();
  let stop: (() => void) | undefined;
  const sync = () => {
    const next = query.getSnapshot();
    const nextKey = JSON.stringify(configuration(next.data));
    if (nextKey !== key) {
      key = nextKey;
      configurationVersion++;
      // A different accepted configuration fences a local ACK; live-field updates do not.
      overlay = undefined;
    }
    if (source === next && appliedOverlay === overlay) return;
    const data = overlay && next.data ? { ...next.data, ...configuration(overlay.saved) } : next.data;
    source = next;
    appliedOverlay = overlay;
    snapshot = { ...next, data };
  };
  const changed = () => {
    sync();
    for (const listener of [...listeners]) listener();
  };
  return {
    isDisposed: query.isDisposed,
    read: query.read,
    refresh: query.refresh,
    getSnapshot() {
      sync();
      return snapshot;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1 && !query.isDisposed()) stop = query.subscribe(changed);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          stop?.();
          stop = undefined;
        }
      };
    },
    begin() {
      sync();
      return { action: ++generation, version: configurationVersion };
    },
    accept(token: { action: number; version: number }, saved: AutoBuildMode) {
      sync();
      if (token.action !== generation || token.version !== configurationVersion || query.isDisposed()) return;
      overlay = { action: token.action, version: token.version, saved };
      changed();
    },
    complete(token: { action: number }) {
      if (overlay?.action !== token.action) return;
      overlay = undefined;
      changed();
    },
    current: (token: { action: number }) => token.action === generation && !query.isDisposed(),
    retire() {
      generation++;
      changed();
    },
  };
};
