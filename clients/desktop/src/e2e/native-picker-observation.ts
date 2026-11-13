import { randomUUID } from "node:crypto";
import { appendFileSync, writeFileSync } from "node:fs";
import type { ConsoleMessage, JSHandle, Page, TestInfo } from "@playwright/test";
import { registerPackagedCleanup } from "../testing/packaged-fixture";

/** Temporary observation of the real input; the callback retains every original action/assertion. */
export const observeNativeProjectPicker = async (
  page: Page,
  project: { id: string; name: string },
  info: TestInfo,
  original: () => Promise<void>,
) => {
  if (process.env.PS204_NATIVE_PICKER_OBSERVATION !== "1") return original();

  const prefix = `ps204-native-picker:${randomUUID()}:`;
  let eventsPath: string;
  let receiptPath: string;
  try {
    eventsPath = info.outputPath("ps204-native-picker-events.jsonl");
    receiptPath = info.outputPath("ps204-native-picker-receipt.json");
  } catch (error) {
    console.error("[ps204-native-picker] output setup failed; original callback retained", error);
    return original();
  }
  const errors: string[] = [];
  let droppedErrors = 0;
  const error = (message: string) => {
    if (errors.length < 32) errors.push(message.slice(0, 1000));
    else droppedErrors++;
  };
  const routes: Array<{ url: string; hostTime: string }> = [];
  let droppedRoutes = 0;
  let hostEvents = 0;
  let hostBytes = 0;
  let droppedEvents = 0;
  let hostCaptureStopped = false;
  let lastReceivedSequence: number | undefined;
  interface PageReceipt {
    disposed: boolean;
    remainingWrappers: number;
    remainingReleases: number;
    expectedRowSeen: boolean;
    incomplete: boolean;
    truncated: boolean;
    errors: string[];
    droppedErrors: number;
    droppedEvents: number;
    droppedResources: number;
    droppedMetadata: number;
    emittedEvents: number;
    emittedBytes: number;
    lastSequence: number;
  }
  let observer: JSHandle<{ finish(): PageReceipt }> | undefined;
  let originalStatus = "not-started";
  let originalError: string | undefined;
  let final: PageReceipt | undefined;
  let contextClosed = page.isClosed();
  let restorationAcknowledged = false;
  let handleReleased = false;
  let cleanupEnded: number | undefined;
  let cleanupAttempts = 0;
  const lifecycle: Array<{ stage: string; sent: number; inFlight: boolean; acknowledged?: number; rejected?: number; expired?: number }> = [];
  const persist = () => {
    try {
      const deliveryComplete = Boolean(final && hostEvents === final.emittedEvents && hostBytes === final.emittedBytes
        && lastReceivedSequence === final.lastSequence);
      const captureComplete = Boolean(final && final.expectedRowSeen && !final.incomplete && !final.truncated
        && final.errors.length === 0 && final.droppedErrors === 0 && final.droppedEvents === 0
        && final.droppedResources === 0 && final.droppedMetadata === 0 && deliveryComplete
        && errors.length === 0 && droppedErrors === 0 && droppedEvents === 0 && droppedRoutes === 0 && !hostCaptureStopped);
      const cleanupComplete = restorationAcknowledged && handleReleased;
      writeFileSync(receiptPath, JSON.stringify({ project, originalStatus, originalError, runnerStatus: info.status,
        routes, errors, droppedErrors, droppedRoutes, hostEvents, hostBytes, droppedEvents, lastReceivedSequence,
        restorationAcknowledged, handleReleased, contextClosed, lifecycle, final, cleanupAttempts, cleanupDeadline, cleanupEnded,
        deliveryComplete, captureComplete, cleanupComplete, partial: !captureComplete || !cleanupComplete,
        cleanupOverrunMs: cleanupEnded && cleanupDeadline ? Math.max(0, cleanupEnded - cleanupDeadline) : undefined }, null, 2));
    } catch (failure) { console.error("[ps204-native-picker] receipt persistence failed", failure); }
  };
  // A deadline never extends Playwright's existing test/fixture allowance. Pending page RPCs
  // are cancelled by the existing owned-app teardown, which this callback must never block.
  const bounded = async <T>(stage: string, operation: () => Promise<T>, deadline: number) => {
    const receipt = { stage, sent: performance.now(), inFlight: true } as (typeof lifecycle)[number];
    lifecycle.push(receipt);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const result = Promise.resolve().then(operation).then(
      (value) => { receipt.inFlight = false; receipt.acknowledged = performance.now(); if (receipt.expired) persist(); return { ok: true as const, value }; },
      (failure: unknown) => { receipt.inFlight = false; receipt.rejected = performance.now(); error(`${stage}: ${String(failure)}`); if (receipt.expired) persist(); return { ok: false as const }; },
    );
    const expiry = new Promise<{ ok: false }>((resolve) => {
      timer = setTimeout(() => { receipt.expired = performance.now(); resolve({ ok: false }); }, Math.max(0, deadline - performance.now()));
    });
    try { return await Promise.race([result, expiry]); }
    finally { clearTimeout(timer); }
  };
  const consoleEvent = (message: ConsoleMessage) => {
    const text = message.text();
    if (!text.startsWith(prefix)) return;
    const line = text.slice(prefix.length);
    const bytes = Buffer.byteLength(line) + 1;
    if (hostCaptureStopped || hostEvents >= 128 || bytes > 16_384 || hostBytes + bytes > 262_144) {
      hostCaptureStopped = true; droppedEvents++; return;
    }
    hostEvents++; hostBytes += bytes;
    try {
      lastReceivedSequence = (JSON.parse(line) as { sequence?: number }).sequence;
      appendFileSync(eventsPath, `${line}\n`);
    } catch (failure) { error(`event persistence: ${String(failure)}`); }
  };
  const routeEvent = (frame: import("@playwright/test").Frame) => {
    if (frame !== page.mainFrame()) return;
    if (routes.length < 16) routes.push({ url: page.url().slice(0, 2000), hostTime: new Date().toISOString() });
    else droppedRoutes++;
  };
  const closed = () => { contextClosed = true; persist(); };
  page.once("close", closed);
  let cleanupDeadline: number | undefined;
  let cleanup: Promise<boolean> | undefined;
  const finish = () => {
    if (restorationAcknowledged && handleReleased) return Promise.resolve(true);
    // Rejected restoration can be retried by the fixture while the SAME deadline remains.
    if (cleanup) return cleanup;
    if (cleanupAttempts >= 2) return Promise.resolve(restorationAcknowledged && handleReleased);
    cleanupAttempts++;
    cleanupDeadline ??= performance.now() + Math.min(750, info.timeout);
    cleanup = (async () => {
      try {
        if (!restorationAcknowledged && observer && performance.now() < cleanupDeadline!) {
          const restored = await bounded("restore", () => observer!.evaluate((owned) => owned.finish()), cleanupDeadline!);
          if (restored.ok) {
            final = restored.value;
            restorationAcknowledged = restored.value.disposed && restored.value.remainingWrappers === 0;
          }
        }
        if (restorationAcknowledged && observer && !handleReleased && performance.now() < cleanupDeadline!) {
          const released = await bounded("handle-release", () => observer!.dispose(), cleanupDeadline!);
          handleReleased = released.ok;
        }
      } catch (failure) { error(`cleanup: ${String(failure)}`); }
      finally {
        page.off("console", consoleEvent);
        page.off("framenavigated", routeEvent);
        if (restorationAcknowledged && handleReleased) page.off("close", closed);
        cleanupEnded = performance.now();
        persist();
      }
      return restorationAcknowledged && handleReleased;
    })();
    void cleanup.then(() => { cleanup = undefined; }, () => { cleanup = undefined; });
    return cleanup;
  };
  registerPackagedCleanup(async () => {
    try { await finish(); }
    catch (failure) { error(`fixture observation cleanup: ${String(failure)}`); persist(); }
  });
  page.on("console", consoleEvent);
  page.on("framenavigated", routeEvent);
  let setupAcknowledged = false;
  try {
    writeFileSync(eventsPath, "");
    info.attachments.push({ name: "native picker observation", path: receiptPath, contentType: "application/json" });
    info.attachments.push({ name: "native picker events", path: eventsPath, contentType: "application/x-ndjson" });
    const setup = await bounded("setup", () => page.evaluateHandle(({ project, prefix }) => {
      type Value = Record<string, unknown>;
      type Context = { memoizedValue?: unknown; next?: Context };
      type Fiber = { key?: string | null; memoizedProps?: Value; return?: Fiber; dependencies?: { firstContext?: Context } };
      const object = (value: unknown) => value !== null && typeof value === "object" ? value as Value : undefined;
      const invoke = (owner: Value | undefined, key: string, ...args: unknown[]) => {
        const method = owner?.[key];
        return typeof method === "function" ? Reflect.apply(method, owner, args) as unknown : undefined;
      };
      const errors: string[] = [];
      let droppedErrors = 0;
      const error = (message: string) => {
        if (errors.length < 32) errors.push(message.slice(0, 1000));
        else droppedErrors++;
      };
      const releases: Array<() => void> = [];
      const liveWrappers: Array<() => boolean> = [];
      const wrapped = new WeakMap<object, Set<string>>();
      const subscribed = new WeakSet<object>();
      let workbench: Value | undefined;
      let controller: Value | undefined;
      let sequence = 0;
      let emittedEvents = 0;
      let emittedBytes = 0;
      let droppedEvents = 0;
      let droppedResources = 0;
      let droppedMetadata = 0;
      let captureStopped = false;
      let wrapperCount = 0;
      let subscriptionCount = 0;
      let expectedRowSeen = false;
      let disposed = false;
      const limit = <T>(values: T[], count: number) => {
        droppedMetadata += Math.max(0, values.length - count);
        return values.slice(0, count);
      };
      const emit = (kind: string, read: () => unknown) => {
        const current = sequence++;
        if (captureStopped || emittedEvents >= 128 || emittedBytes >= 262_144) { captureStopped = true; droppedEvents++; return; }
        try {
          const line = JSON.stringify({ sequence: current, timeOrigin: performance.timeOrigin, now: performance.now(), kind, value: read() });
          const bytes = new TextEncoder().encode(line).byteLength + 1;
          if (bytes > 16_384 || emittedBytes + bytes > 262_144) { captureStopped = true; droppedEvents++; return; }
          emittedEvents++; emittedBytes += bytes;
          console.debug(prefix + line);
        } catch (failure) { error(`emit ${kind}: ${String(failure)}`); }
      };
      const guarded = (stage: string, read: () => unknown) => {
        try { return read(); }
        catch (failure) { error(`${stage}: ${String(failure)}`); return { unavailable: stage }; }
      };
      const identify = (element: Element | null) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName, id: element.id, role: element.getAttribute("role"),
          text: element.matches('p,[role="option"],[role="tab"]') ? element.textContent?.slice(0, 180) : undefined,
          connected: element.isConnected, hidden: element.hasAttribute("hidden"), inert: element.hasAttribute("inert"),
          disabled: element.hasAttribute("disabled"), ariaDisabled: element.getAttribute("aria-disabled"),
          widgetId: element.getAttribute("data-workbench-instance"), scope: element.hasAttribute("data-ui-scope"),
          pointerEvents: getComputedStyle(element).pointerEvents,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        };
      };
      const snapshot = () => guarded("snapshot", () => {
        const context = object(invoke(object(object(workbench?.context)?.store), "getState"));
        const state = object(invoke(controller, "getState"));
        const active = object(state?.active);
        const entries = Array.isArray(state?.workbenches) ? state.workbenches : [];
        return {
          url: location.href, selectedProjectId: object(context?.values)?.["dashboard.project.id"],
          workbenchActive: invoke(object(workbench?.activation), "isActive"),
          overlays: (() => {
            const overlay = object(object(object(invoke(object(workbench?.layout), "getLayout"))?.regions)?.overlay);
            const widgets = Array.isArray(overlay?.widgets) ? overlay.widgets : [];
            return { activeWidgetId: overlay?.activeWidgetId, count: widgets.length,
              widgets: limit(widgets, 16).map((entry) => ({ widgetId: object(entry)?.widgetId, viewId: object(entry)?.viewId, viewerKey: object(entry)?.viewerKey })) };
          })(),
          controller: controller ? {
            projectIds: Array.isArray(state?.projectIds) ? limit(state.projectIds, 16) : undefined, activeKey: active?.key, activeProjectId: active?.projectId,
            workbenchCount: entries.length, ownerEntries: limit(entries, 16).filter((entry) => object(entry)?.workbench === workbench)
              .map((entry) => ({ key: object(entry)?.key, projectId: object(entry)?.projectId })),
          } : null,
          tabs: limit(Array.from(document.querySelectorAll('[role="tablist"][aria-label="Project tabs"] [role="tab"]')), 16)
            .map((tab) => ({ id: tab.id, text: tab.textContent?.slice(0, 180), selected: tab.getAttribute("aria-selected"), hiddenOwner: Boolean(tab.closest("[hidden],[inert]")) })),
        };
      });
      const wrap = (owner: Value | undefined, key: string, label: string) => {
        const original = owner?.[key];
        if (!owner || typeof original !== "function") return false;
        let keys = wrapped.get(owner);
        if (keys?.has(key)) return true;
        if (wrapperCount >= 32) { droppedResources++; return false; }
        const descriptor = Object.getOwnPropertyDescriptor(owner, key);
        if (descriptor && (!("value" in descriptor) || (!descriptor.writable && !descriptor.configurable))) {
          error(`non-writable ${label}`); return false;
        }
        const wrapper = function (this: unknown, ...args: unknown[]) {
          guarded(`${label} entry`, () => emit(`${label}.entry`, () => ({
            argumentId: typeof args[0] === "string" ? args[0] : undefined,
            project: object(args[0])?.project ?? object(args[1])?.project,
            targetId: label === "controller.select" ? args[0] : undefined,
            event: label === "row.onClick" ? {
              defaultPrevented: object(args[0])?.defaultPrevented,
              target: identify(object(args[0])?.target as Element | null),
              currentTarget: identify(object(args[0])?.currentTarget as Element | null),
            } : undefined,
            state: snapshot(),
          })));
          try {
            // Do not attach Promise handlers: preserve this, arguments, return identity and throws.
            const result: unknown = Reflect.apply(original, this, args);
            guarded(`${label} return`, () => emit(`${label}.return`, () => ({ state: snapshot() })));
            return result;
          } catch (error) {
            guarded(`${label} throw`, () => emit(`${label}.throw`, () => ({ error: String(error), state: snapshot() })));
            throw error;
          }
        };
        try {
          Object.defineProperty(owner, key, descriptor ? { ...descriptor, value: wrapper } : { configurable: true, writable: true, value: wrapper });
          wrapperCount++;
          liveWrappers.push(() => owner[key] === wrapper);
          if (!keys) { keys = new Set(); wrapped.set(owner, keys); }
          keys.add(key);
          releases.push(() => {
            if (owner[key] !== wrapper) { error(`ownership changed ${label}`); return; }
            if (descriptor) Object.defineProperty(owner, key, descriptor);
            else delete owner[key];
          });
          return true;
        } catch (failure) { error(`wrap ${label}: ${String(failure)}`); return false; }
      };
      const subscribe = (owner: Value | undefined, key: string, label: string) => {
        if (!owner || subscribed.has(owner)) return;
        if (subscriptionCount >= 8) { droppedResources++; return; }
        const release = invoke(owner, key, () => guarded(label, () => emit(label, snapshot)));
        if (typeof release === "function") { subscriptionCount++; subscribed.add(owner); releases.push(() => { release(); }); }
        else error(`subscription unavailable ${label}`);
      };
      const bind = (row: Element) => {
        const fiberKey = Object.keys(row).find((key) => key.startsWith("__reactFiber$"));
        let fiber = fiberKey ? (row as unknown as Record<string, Fiber>)[fiberKey] : undefined;
        const ancestors: unknown[] = [];
        for (let depth = 0; fiber && depth < 256; depth++, fiber = fiber.return) {
          const props = fiber.memoizedProps;
          const input = object(props?.input);
          const candidate = object(input?.workbench) ?? object(props?.workbench);
          if (!workbench && object(candidate?.commands)) workbench = candidate;
          const candidateController = object(props?.controller);
          if (typeof candidateController?.getState === "function" && typeof candidateController?.select === "function") controller = candidateController;
          const scopes: unknown[] = [];
          let context = fiber.dependencies?.firstContext;
          for (let index = 0; context && index < 64; index++, context = context.next) {
            const value = object(context.memoizedValue);
            const root = object(value?.root)?.current;
            if (typeof value?.active === "boolean" && root instanceof Element)
              scopes.push({ active: value.active, root: identify(root), containsRow: root.contains(row) });
          }
          if (context) droppedMetadata++;
          if (input || props?.placement || typeof props?.active === "boolean" || scopes.length) {
            if (ancestors.length < 16) ancestors.push({ key: fiber.key, active: props?.active, visible: props?.visible,
              placement: props?.placement ? { widgetId: object(props.placement)?.widgetId, viewId: object(props.placement)?.viewId } : undefined,
              input: input ? { instanceId: object(input.instance)?.id, region: input.region, visible: input.visible } : undefined, scopes });
            else droppedMetadata++;
          }
        }
        if (fiber) droppedMetadata++;
        const propsKey = Object.keys(row).find((key) => key.startsWith("__reactProps$"));
        const commands = object(workbench?.commands);
        const handler = object(object(invoke(commands, "getCommand", "dashboard.selectProject"))?.handler);
        const bindings = {
          rowClick: wrap(propsKey ? object((row as unknown as Value)[propsKey]) : undefined, "onClick", "row.onClick"),
          command: wrap(commands, "executeCommand", "command.executeCommand"),
          handler: wrap(handler, "execute", "command.handler"), controller: wrap(controller, "select", "controller.select"),
          overlayClose: wrap(object(workbench?.overlays), "closeOverlay", "overlay.close"),
        };
        if (!workbench || !controller || Object.values(bindings).some((bound) => !bound)) error("binding incomplete");
        emit("binding", () => ({ ancestors, fiberFound: Boolean(fiberKey), ancestryTruncated: Boolean(fiber), workbenchFound: Boolean(workbench), controllerFound: Boolean(controller), ...bindings }));
        subscribe(controller, "subscribeState", "controller.state");
        subscribe(object(object(workbench?.context)?.store), "subscribe", "selection.state");
        subscribe(object(object(workbench?.activation)?.store), "subscribe", "activation.state");
        subscribe(object(object(workbench?.layout)?.store), "subscribe", "layout.state");
        if (commands && !subscribed.has(commands)) {
          if (subscriptionCount >= 8) { droppedResources++; return; }
          const release = object(invoke(commands, "onDidExecuteError", (event: unknown) => guarded("command error", () => {
            const value = object(event);
            emit("command.error", () => ({ commandId: value?.commandId, project: object(value?.args)?.project, error: String(value?.error), state: snapshot() }));
          })));
          if (typeof release?.dispose === "function") {
            subscribed.add(commands);
            subscriptionCount++;
            releases.push(() => { invoke(release, "dispose"); });
          } else error("command error subscription unavailable");
        }
      };
      const inputEvent = (event: Event) => guarded("input", () => {
        const target = event.target instanceof Element ? event.target : null;
        const row = target?.closest('[role="option"]') ?? null;
        const pointer = event as MouseEvent;
        emit(event.type, () => ({
          trusted: event.isTrusted, defaultPrevented: event.defaultPrevented, x: pointer.clientX, y: pointer.clientY,
          target: identify(target), row: identify(row), expectedRow: row?.id === project.id,
          dialog: identify(target?.closest('[role="dialog"]') ?? null),
          path: limit(event.composedPath().filter((entry): entry is Element => entry instanceof Element), 16).map(identify),
          hitTest: limit(document.elementsFromPoint(pointer.clientX, pointer.clientY), 16).map(identify), state: snapshot(),
        }));
        if (row?.id === project.id) { expectedRowSeen = true; bind(row); }
      });
      const mutation = new MutationObserver(() => {
        if (expectedRowSeen) guarded("DOM state", () => emit("DOM.state", snapshot));
      });
      const finish = () => {
        mutation.disconnect();
        document.removeEventListener("pointerdown", inputEvent, true);
        document.removeEventListener("click", inputEvent, true);
        // Installation is capped; this complete owned release list is NEVER truncated.
        let remainingReleases = 0;
        for (const release of [...releases].reverse()) {
          try { release(); }
          catch (failure) { remainingReleases++; error(`release: ${String(failure)}`); }
        }
        const remainingWrappers = liveWrappers.filter((read) => guarded("ownership", read) !== false).length;
        disposed = remainingWrappers === 0 && remainingReleases === 0;
        return { disposed, remainingWrappers, remainingReleases, expectedRowSeen, state: snapshot(), errors, droppedErrors,
          emittedEvents, emittedBytes, lastSequence: sequence - 1, droppedEvents, droppedResources,
          wrapperCount, subscriptionCount, droppedMetadata, truncated: droppedEvents > 0 || droppedResources > 0 || droppedErrors > 0 || droppedMetadata > 0,
          incomplete: errors.length > 0 || !expectedRowSeen || droppedEvents > 0 || droppedResources > 0 || droppedMetadata > 0 };
      };
      try {
        document.addEventListener("pointerdown", inputEvent, { capture: true, passive: true });
        document.addEventListener("click", inputEvent, { capture: true, passive: true });
        mutation.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "inert", "aria-selected"] });
        emit("installed", () => ({ project, state: snapshot() }));
        return { finish };
      } catch (failure) {
        finish();
        throw failure;
      }
    }, { project, prefix }), performance.now() + Math.min(750, info.timeout));
    if (setup.ok) { observer = setup.value; setupAcknowledged = true; }
  } catch (failure) { error(`setup: ${String(failure)}`); }
  if (!setupAcknowledged) {
    await finish();
    throw new Error("Native picker diagnostic setup unacknowledged; original boundary NOT RUN; owned app teardown must cancel pending page RPCs");
  }
  let originalFailed = false;
  let originalThrown: unknown;
  try {
    originalStatus = "running";
    await original();
    originalStatus = "passed";
  } catch (failure) {
    originalFailed = true;
    originalThrown = failure;
    originalStatus = "failed";
    try { originalError = String(failure); }
    catch { originalError = "Unprintable original thrown value"; }
  }
  let released = false;
  try { released = await finish(); }
  catch (failure) { error(`observation cleanup: ${String(failure)}`); persist(); }
  if (originalFailed) throw originalThrown;
  if (!released) throw new Error("Native picker diagnostic cleanup unacknowledged; stop before continuing with live wrappers; owned app teardown required");
};
