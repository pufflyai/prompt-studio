export type ChatMountMetric = {
  id: string;
  scenario: string;
  label: string;
  totalMs: number;
  messageCount: number;
  perMessageMs: number | null;
  startedAtMs: number;
  completedAtMs: number;
};

type PendingChatMountMetric = {
  scenario: string;
  label: string;
  messageCount: number;
  startedAtMs: number;
};

type StartChatMountMetricInput = {
  scenario: string;
  label: string;
  messageCount: number;
  startMarkName?: string;
};

type FinishChatMountMetricInput = {
  id: string;
  messageCount: number;
  readyMarkName?: string;
};

declare global {
  interface Window {
    __chatPanelMountMetrics?: ChatMountMetric[];
    __chatPanelPendingMountMetrics?: Record<string, PendingChatMountMetric>;
  }
}

const ensureMountMetricStores = () => {
  if (typeof window === "undefined") return null;
  window.__chatPanelMountMetrics ??= [];
  window.__chatPanelPendingMountMetrics ??= {};
  return {
    metrics: window.__chatPanelMountMetrics,
    pending: window.__chatPanelPendingMountMetrics,
  };
};

const mark = (markName?: string) => {
  if (!markName || typeof performance === "undefined") return;
  performance.mark(markName);
};

export const startChatMountMetric = (input: StartChatMountMetricInput) => {
  const stores = ensureMountMetricStores();
  const now = typeof performance === "undefined" ? 0 : performance.now();
  const id = `${input.scenario}:${Math.round(now)}:${Math.random().toString(16).slice(2)}`;

  if (!stores) return id;

  stores.pending[id] = {
    scenario: input.scenario,
    label: input.label,
    messageCount: input.messageCount,
    startedAtMs: now,
  };

  mark(input.startMarkName);
  return id;
};

export const finishChatMountMetricAfterPaint = (input: FinishChatMountMetricInput) => {
  const recordMetric = () => {
    const stores = ensureMountMetricStores();
    if (!stores) return;

    const pending = stores.pending[input.id];
    if (!pending) return;

    const completedAtMs = performance.now();
    const messageCount = input.messageCount;
    const totalMs = completedAtMs - pending.startedAtMs;

    stores.metrics.push({
      id: input.id,
      scenario: pending.scenario,
      label: pending.label,
      totalMs,
      messageCount,
      perMessageMs: messageCount > 0 ? totalMs / messageCount : null,
      startedAtMs: pending.startedAtMs,
      completedAtMs,
    });

    delete stores.pending[input.id];
    mark(input.readyMarkName);
  };

  if (typeof requestAnimationFrame === "undefined") {
    recordMetric();
    return;
  }

  requestAnimationFrame(() => requestAnimationFrame(recordMetric));
};

export const readLatestChatMountMetric = (scenario: string) => {
  if (typeof window === "undefined") return null;

  return window.__chatPanelMountMetrics?.filter((metric) => metric.scenario === scenario).at(-1) ?? null;
};
