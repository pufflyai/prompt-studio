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
  const eventsPath = info.outputPath("ps204-native-picker-events.jsonl");
  const receiptPath = info.outputPath("ps204-native-picker-receipt.json");
  const errors: string[] = [];
  const routes: Array<{ url: string; hostTime: string }> = [];
  let observer: JSHandle<{ finish(): unknown }> | undefined;
  let originalStatus = "not-started";
  let originalError: string | undefined;
  let finished = false;
  const consoleEvent = (message: ConsoleMessage) => {
    const text = message.text();
    if (!text.startsWith(prefix)) return;
    try { appendFileSync(eventsPath, `${text.slice(prefix.length)}\n`); }
    catch (error) { errors.push(`event persistence: ${String(error)}`); }
  };
  const routeEvent = () => routes.push({ url: page.url(), hostTime: new Date().toISOString() });
  const finish = async () => {
    if (finished) return;
    finished = true;
    let final: unknown;
    try { final = await observer?.evaluate((owned) => owned.finish()); }
    catch (error) { errors.push(`page cleanup/capture: ${String(error)}`); }
    finally {
      page.off("console", consoleEvent);
      page.off("framenavigated", routeEvent);
      try { await observer?.dispose(); }
      catch (error) { errors.push(`handle release: ${String(error)}`); }
      try {
        writeFileSync(receiptPath, JSON.stringify({ project, originalStatus, originalError, runnerStatus: info.status, runnerErrors: info.errors, routes, final, errors }, null, 2));
        info.attachments.push({ name: "native picker observation", path: receiptPath, contentType: "application/json" });
        info.attachments.push({ name: "native picker events", path: eventsPath, contentType: "application/x-ndjson" });
      } catch (error) {
        console.error("[ps204-native-picker] receipt persistence failed", error);
      }
    }
  };
  const safeFinish = async () => {
    try { await finish(); }
    catch (error) { console.error("[ps204-native-picker] cleanup failed; original result retained", error); }
  };
  registerPackagedCleanup(safeFinish);
  page.on("console", consoleEvent);
  page.on("framenavigated", routeEvent);
  try {
    writeFileSync(eventsPath, "");
    observer = await page.evaluateHandle(({ project, prefix }) => {
      type Value = Record<string, unknown>;
      type Context = { memoizedValue?: unknown; next?: Context };
      type Fiber = { key?: string | null; memoizedProps?: Value; return?: Fiber; dependencies?: { firstContext?: Context } };
      const object = (value: unknown) => value !== null && typeof value === "object" ? value as Value : undefined;
      const invoke = (owner: Value | undefined, key: string, ...args: unknown[]) => {
        const method = owner?.[key];
        return typeof method === "function" ? Reflect.apply(method, owner, args) as unknown : undefined;
      };
      const errors: string[] = [];
      const releases: Array<() => void> = [];
      const wrapped = new WeakMap<object, Set<string>>();
      const subscribed = new WeakSet<object>();
      let workbench: Value | undefined;
      let controller: Value | undefined;
      let sequence = 0;
      let expectedRowSeen = false;
      let disposed = false;
      const emit = (kind: string, value: unknown) => {
        try { console.debug(prefix + JSON.stringify({ sequence: sequence++, timeOrigin: performance.timeOrigin, now: performance.now(), kind, value })); }
        catch (error) { errors.push(`emit ${kind}: ${String(error)}`); }
      };
      const guarded = (stage: string, read: () => unknown) => {
        try { return read(); }
        catch (error) { errors.push(`${stage}: ${String(error)}`); return { unavailable: stage }; }
      };
      const identify = (element: Element | null) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName, id: element.id, role: element.getAttribute("role"), text: element.textContent?.slice(0, 180),
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
          overlays: object(object(invoke(object(workbench?.layout), "getLayout"))?.regions)?.overlay,
          controller: controller ? {
            projectIds: state?.projectIds, activeKey: active?.key, activeProjectId: active?.projectId,
            ownerEntries: entries.filter((entry) => object(entry)?.workbench === workbench)
              .map((entry) => ({ key: object(entry)?.key, projectId: object(entry)?.projectId })),
          } : null,
          tabs: Array.from(document.querySelectorAll('[role="tablist"][aria-label="Project tabs"] [role="tab"]'))
            .map((tab) => ({ id: tab.id, text: tab.textContent, selected: tab.getAttribute("aria-selected"), hiddenOwner: Boolean(tab.closest("[hidden],[inert]")) })),
        };
      });
      const wrap = (owner: Value | undefined, key: string, label: string) => {
        const original = owner?.[key];
        if (!owner || typeof original !== "function") return false;
        let keys = wrapped.get(owner);
        if (keys?.has(key)) return true;
        const descriptor = Object.getOwnPropertyDescriptor(owner, key);
        if (descriptor && (!("value" in descriptor) || (!descriptor.writable && !descriptor.configurable))) {
          errors.push(`non-writable ${label}`); return false;
        }
        const wrapper = function (this: unknown, ...args: unknown[]) {
          guarded(`${label} entry`, () => emit(`${label}.entry`, {
            argumentId: typeof args[0] === "string" ? args[0] : undefined,
            project: object(args[0])?.project ?? object(args[1])?.project,
            targetId: label === "controller.select" ? args[0] : undefined,
            event: label === "row.onClick" ? {
              defaultPrevented: object(args[0])?.defaultPrevented,
              target: identify(object(args[0])?.target as Element | null),
              currentTarget: identify(object(args[0])?.currentTarget as Element | null),
            } : undefined,
            state: snapshot(),
          }));
          try {
            // Do not attach Promise handlers: preserve this, arguments, return identity and throws.
            const result: unknown = Reflect.apply(original, this, args);
            guarded(`${label} return`, () => emit(`${label}.return`, { state: snapshot() }));
            return result;
          } catch (error) {
            guarded(`${label} throw`, () => emit(`${label}.throw`, { error: String(error), state: snapshot() }));
            throw error;
          }
        };
        try {
          Object.defineProperty(owner, key, descriptor ? { ...descriptor, value: wrapper } : { configurable: true, writable: true, value: wrapper });
          if (!keys) { keys = new Set(); wrapped.set(owner, keys); }
          keys.add(key);
          releases.push(() => {
            if (owner[key] !== wrapper) { errors.push(`ownership changed ${label}`); return; }
            if (descriptor) Object.defineProperty(owner, key, descriptor);
            else delete owner[key];
          });
          return true;
        } catch (error) { errors.push(`wrap ${label}: ${String(error)}`); return false; }
      };
      const subscribe = (owner: Value | undefined, key: string, label: string) => {
        if (!owner || subscribed.has(owner)) return;
        const release = invoke(owner, key, () => guarded(label, () => emit(label, snapshot())));
        if (typeof release === "function") { subscribed.add(owner); releases.push(() => { release(); }); }
        else errors.push(`subscription unavailable ${label}`);
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
          for (let index = 0; context && index < 32; index++, context = context.next) {
            const value = object(context.memoizedValue);
            const root = object(value?.root)?.current;
            if (typeof value?.active === "boolean" && root instanceof Element)
              scopes.push({ active: value.active, root: identify(root), containsRow: root.contains(row) });
          }
          if (input || props?.placement || typeof props?.active === "boolean" || scopes.length)
            ancestors.push({ key: fiber.key, active: props?.active, visible: props?.visible, placement: props?.placement, input: input ? { instance: input.instance, region: input.region, visible: input.visible } : undefined, scopes });
        }
        const propsKey = Object.keys(row).find((key) => key.startsWith("__reactProps$"));
        const commands = object(workbench?.commands);
        const handler = object(object(invoke(commands, "getCommand", "dashboard.selectProject"))?.handler);
        emit("binding", {
          ancestors, fiberFound: Boolean(fiberKey), workbenchFound: Boolean(workbench), controllerFound: Boolean(controller),
          rowClick: wrap(propsKey ? object((row as unknown as Value)[propsKey]) : undefined, "onClick", "row.onClick"),
          command: wrap(commands, "executeCommand", "command.executeCommand"),
          handler: wrap(handler, "execute", "command.handler"), controller: wrap(controller, "select", "controller.select"),
          overlayClose: wrap(object(workbench?.overlays), "closeOverlay", "overlay.close"),
        });
        subscribe(controller, "subscribeState", "controller.state");
        subscribe(object(object(workbench?.context)?.store), "subscribe", "selection.state");
        subscribe(object(object(workbench?.activation)?.store), "subscribe", "activation.state");
        subscribe(object(object(workbench?.layout)?.store), "subscribe", "layout.state");
        if (commands && !subscribed.has(commands)) {
          const release = object(invoke(commands, "onDidExecuteError", (event: unknown) => guarded("command error", () => {
            const value = object(event);
            emit("command.error", { commandId: value?.commandId, project: object(value?.args)?.project, error: String(value?.error), state: snapshot() });
          })));
          if (typeof release?.dispose === "function") {
            subscribed.add(commands);
            releases.push(() => { invoke(release, "dispose"); });
          } else errors.push("command error subscription unavailable");
        }
      };
      const inputEvent = (event: Event) => guarded("input", () => {
        const target = event.target instanceof Element ? event.target : null;
        const row = target?.closest('[role="option"]') ?? null;
        const pointer = event as MouseEvent;
        emit(event.type, {
          trusted: event.isTrusted, defaultPrevented: event.defaultPrevented, x: pointer.clientX, y: pointer.clientY,
          target: identify(target), row: identify(row), expectedRow: row?.id === project.id,
          dialog: identify(target?.closest('[role="dialog"]') ?? null),
          path: event.composedPath().filter((entry): entry is Element => entry instanceof Element).map(identify),
          hitTest: document.elementsFromPoint(pointer.clientX, pointer.clientY).map(identify), state: snapshot(),
        });
        if (row?.id === project.id) { expectedRowSeen = true; bind(row); }
      });
      document.addEventListener("pointerdown", inputEvent, true);
      document.addEventListener("click", inputEvent, true);
      const mutation = new MutationObserver(() => guarded("DOM state", () => emit("DOM.state", snapshot())));
      mutation.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "inert", "aria-selected"] });
      emit("installed", { project, state: snapshot() });
      return {
        finish() {
          if (disposed) return { disposed, errors };
          disposed = true;
          mutation.disconnect();
          document.removeEventListener("pointerdown", inputEvent, true);
          document.removeEventListener("click", inputEvent, true);
          for (const release of releases.reverse()) guarded("release", release);
          const final = { disposed, expectedRowSeen, state: snapshot(), errors };
          emit("finished", final);
          return final;
        },
      };
    }, { project, prefix });
  } catch (error) { errors.push(`setup: ${String(error)}`); }
  try {
    originalStatus = "running";
    await original();
    originalStatus = "passed";
  } catch (error) {
    originalStatus = "failed";
    originalError = String(error);
    throw error;
  } finally { await safeFinish(); }
};
