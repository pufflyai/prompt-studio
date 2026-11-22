import { createWebviewClient, defineExtensionView, isLocalizedString } from "@pstdio/sdk/extensions";
import { drawWorkspaceHistory } from "./workspace-history-chart";
import { defaultHistoryRange, historyRanges, workspaceHistoryCommandId } from "./workspace-history-range";
import type { workspaceHistoryCommands } from "./workspace-history-view";
import "./workspace-history.css";

const layout = `
  <section class="history">
    <header>
      <div>
        <h1 data-title></h1>
        <p data-instance></p>
      </div>
      <label><span data-range-label></span> <select></select></label>
    </header>
    <div class="history-metrics">
      <div><span data-running-label></span><strong data-running>–</strong></div>
      <div><span data-peak-label></span><strong data-peak>–</strong></div>
    </div>
    <div class="history-plot">
      <canvas tabindex="0" role="img"
        aria-describedby="history-detail"></canvas>
      <output id="history-detail" aria-live="polite"></output>
    </div>
    <p class="history-note"></p>
    <p class="history-status" role="status"></p>
  </section>
`;

function element<T extends Element>(mount: HTMLElement, selector: string) {
  const node = mount.querySelector<T>(selector);
  if (!node) throw new Error(`Missing workspace history element ${selector}`);
  return node;
}

export default defineExtensionView({
  render(context) {
    const { mount, host, propsStore, t } = context;
    mount.innerHTML = layout;
    const client = createWebviewClient<typeof workspaceHistoryCommands>(host);
    const range = element<HTMLSelectElement>(mount, "select");
    const canvas = element<HTMLCanvasElement>(mount, "canvas");
    const detail = element<HTMLOutputElement>(mount, "output");
    const instance = element<HTMLElement>(mount, "[data-instance]");
    const running = element<HTMLElement>(mount, "[data-running]");
    const peak = element<HTMLElement>(mount, "[data-peak]");
    const status = element<HTMLElement>(mount, ".history-status");
    const plot = element<HTMLElement>(mount, ".history-plot");
    plot.hidden = true;

    let data: Awaited<ReturnType<(typeof client.commands)[typeof workspaceHistoryCommandId]>> | undefined;
    let request: AbortController | undefined;
    let selected = -1;

    const draw = () => {
      if (!data) return;
      drawWorkspaceHistory(canvas, data.points, data.peak, selected, context.locale);
      const point = data.points[selected] ?? data.points.at(-1);
      if (point)
        detail.textContent = `${new Date(point.time).toLocaleString(context.locale)} · ${t(
          "cloud-workspaces.history-running-count",
          "{{count}} running",
          { count: point.count },
        )}`;
    };

    const loadingText = () => t("cloud-workspaces.history-loading", "Loading workspace history…");
    const translate = () => {
      element(mount, "[data-title]").textContent = t("cloud-workspaces.history-running-title", "Running workspaces");
      element(mount, "[data-range-label]").textContent = t("cloud-workspaces.time-range", "Time range");
      element(mount, "[data-running-label]").textContent = t("cloud-workspaces.history-running-now", "Running now");
      element(mount, "[data-peak-label]").textContent = t("cloud-workspaces.history-peak", "Peak in range");
      element(mount, ".history-note").textContent = t(
        "cloud-workspaces.history-note",
        "Counts workspaces from ready until they end. History uses the records retained by the controller.",
      );
      canvas.setAttribute("aria-label", t("cloud-workspaces.history-accessible-plot", "Running workspaces over time"));
      const selectedRange = range.value || defaultHistoryRange;
      range.replaceChildren(
        ...historyRanges.map(
          ({ label, localizedLabel, value }) =>
            new Option(isLocalizedString(localizedLabel) ? t(localizedLabel.$l10n, label) : label, value),
        ),
      );
      range.value = selectedRange;
      if (request && !data) status.textContent = loadingText();
      draw();
    };

    const load = async () => {
      if (request) return;
      const next = new AbortController();
      request = next;
      try {
        const result = await client.commands[workspaceHistoryCommandId]
          .query({ range: range.value })
          .refresh(next.signal);
        if (next.signal.aborted) return;
        data = result;
        selected = -1;
        instance.textContent = data.name;
        running.textContent = String(data.running);
        peak.textContent = String(data.peak);
        status.textContent = "";
        plot.hidden = false;
        draw();
      } catch (error) {
        if (next.signal.aborted) return;
        status.textContent = error instanceof Error ? error.message : String(error);
      } finally {
        if (request === next) request = undefined;
      }
    };

    range.addEventListener("change", () => {
      request?.abort();
      request = undefined;
      data = undefined;
      plot.hidden = true;
      running.textContent = "–";
      peak.textContent = "–";
      status.textContent = loadingText();
      void load();
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!data) return;
      const first = data.points[0];
      const last = data.points.at(-1);
      if (!first || !last) return;
      const position = (event.offsetX - 36) / (canvas.clientWidth - 54);
      const time = first.time + position * (last.time - first.time);
      selected = Math.max(
        0,
        data.points.findLastIndex((point) => point.time <= time),
      );
      draw();
    });
    canvas.addEventListener("pointerleave", () => {
      selected = -1;
      draw();
    });
    canvas.addEventListener("keydown", (event) => {
      if (!data || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
      event.preventDefault();
      const index = selected < 0 ? data.points.length - 1 : selected;
      const next = index + (event.key === "ArrowLeft" ? -1 : 1);
      selected = Math.max(0, Math.min(data.points.length - 1, next));
      draw();
    });

    const resize = new ResizeObserver(draw);
    resize.observe(canvas);
    const refreshVisible = () => {
      if (!document.hidden) void load();
    };
    const timer = window.setInterval(refreshVisible, 30_000);
    document.addEventListener("visibilitychange", refreshVisible);
    const unsubscribe = propsStore.subscribe(translate);
    translate();
    status.textContent = loadingText();
    void load();
    return () => {
      unsubscribe();
      request?.abort();
      resize.disconnect();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  },
});
