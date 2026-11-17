import { expect, test } from "bun:test";
import { createWorkbench, type WorkbenchWidgetPlacement } from "../../core";
import { settingsLeaveGuard } from "../settings/settings-leave-guard";
import { createWorkbenchSettingsModule, WORKBENCH_SETTINGS_WIDGET_ID } from "../settings/settings-module";
import { settingsPanelResource } from "../settings/settings-resources";
import { createOverlayCloseHandler } from "./overlay-dismissal";

const setup = () => {
  const workbench = createWorkbench();
  workbench.registerModule(createWorkbenchSettingsModule());
  const open = (id: string) => {
    workbench.overlays.openOverlay(WORKBENCH_SETTINGS_WIDGET_ID, {
      resource: settingsPanelResource({ id, title: id }),
    });
    return workbench.layout.getLayout().regions.overlay.widgets[0]!;
  };
  const first = open("first");
  const guard = settingsLeaveGuard(workbench);
  let dirty = true;
  guard.register({
    title: "First settings",
    get dirty() {
      return dirty;
    },
    save: () => {
      dirty = false;
    },
    reset: () => {
      dirty = false;
    },
  });
  const exited: WorkbenchWidgetPlacement[] = [];
  const close = createOverlayCloseHandler({ workbench, placement: first, open: true, onExit: (p) => exited.push(p) });
  return { workbench, first, guard, open, close, exited };
};

test("a prior settings leave decision cannot close a reopened singleton", async () => {
  const fixture = setup();
  try {
    const closing = fixture.close({ open: false });
    expect(fixture.guard.getSnapshot()?.title).toBe("First settings");
    const second = fixture.open("second");
    expect(second.widgetId).toBe(fixture.first.widgetId);
    await fixture.guard.leave(false);
    await closing;
    expect(fixture.workbench.layout.getLayout().regions.overlay.widgets).toEqual([second]);
    expect(fixture.exited).toEqual([]);
  } finally {
    fixture.workbench.dispose();
  }
});

test("discarding the current settings draft closes its own opening", async () => {
  const fixture = setup();
  try {
    const closing = fixture.close({ open: false });
    await fixture.guard.leave(false);
    await closing;
    expect(fixture.workbench.layout.getLayout().regions.overlay.widgets).toEqual([]);
    expect(fixture.exited).toEqual([fixture.first]);
  } finally {
    fixture.workbench.dispose();
  }
});

test("staying with the current settings draft preserves its opening", async () => {
  const fixture = setup();
  try {
    const closing = fixture.close({ open: false });
    fixture.guard.stay();
    await closing;
    expect(fixture.workbench.layout.getLayout().regions.overlay.widgets).toEqual([fixture.first]);
    expect(fixture.exited).toEqual([]);
  } finally {
    fixture.workbench.dispose();
  }
});

test("a retired close callback cannot prompt for a newer settings opening", async () => {
  const fixture = setup();
  try {
    const second = fixture.open("second");
    const closing = fixture.close({ open: false });
    const warning = fixture.guard.getSnapshot();
    fixture.guard.stay();
    await closing;
    expect(warning).toBeNull();
    expect(fixture.workbench.layout.getLayout().regions.overlay.widgets).toEqual([second]);
    expect(fixture.exited).toEqual([]);
  } finally {
    fixture.workbench.dispose();
  }
});

test("exit publication cannot transfer an admitted close to a reentrant opening", async () => {
  const fixture = setup();
  try {
    const close = createOverlayCloseHandler({
      workbench: fixture.workbench,
      placement: fixture.first,
      open: true,
      onExit: () => fixture.open("second"),
    });
    const closing = close({ open: false });
    await fixture.guard.leave(false);
    await closing;
    expect(fixture.workbench.layout.getLayout().regions.overlay.widgets[0]?.resource?.id).toBe("second");
  } finally {
    fixture.workbench.dispose();
  }
});

test("page dialogs opened directly through layout still close", async () => {
  const workbench = createWorkbench();
  try {
    workbench.layout.registerPanel({
      id: "page-dialog",
      title: "Page",
      rendererId: "page",
      region: "overlay",
      closable: true,
    });
    workbench.layout.openPanel("page-dialog");
    const placement = workbench.layout.getLayout().regions.overlay.widgets[0]!;
    expect(workbench.overlays.captureInvocation(placement.widgetId)).toBeUndefined();
    const close = createOverlayCloseHandler({ workbench, placement, open: true, onExit: () => {} });
    await close({ open: false });
    expect(workbench.layout.getLayout().regions.overlay.widgets).toEqual([]);
  } finally {
    workbench.dispose();
  }
});

test("a close handler captured by the new layout publication owns that opening", async () => {
  const fixture = setup();
  let close: ReturnType<typeof createOverlayCloseHandler> | undefined;
  const stop = fixture.workbench.layout.store.subscribe(() => {
    const placement = fixture.workbench.layout.getLayout().regions.overlay.widgets[0];
    if (placement?.resource?.id !== "second" || close) return;
    close = createOverlayCloseHandler({ workbench: fixture.workbench, placement, open: true, onExit: () => {} });
  });
  try {
    fixture.open("second");
    expect(close).toBeDefined();
    const closing = close!({ open: false });
    await fixture.guard.leave(false);
    await closing;
    expect(fixture.workbench.layout.getLayout().regions.overlay.widgets).toEqual([]);
  } finally {
    stop();
    fixture.workbench.dispose();
  }
});

test("a reentrant layout observer's newer overlay keeps its opening authority", () => {
  const fixture = setup();
  let latest: (() => boolean) | undefined;
  const stop = fixture.workbench.layout.store.subscribe(() => {
    const placement = fixture.workbench.layout.getLayout().regions.overlay.widgets[0];
    if (placement?.resource?.id === "second") {
      const third = fixture.open("third");
      latest = fixture.workbench.overlays.captureInvocation(third.widgetId);
    }
  });
  try {
    fixture.open("second");
    expect(fixture.workbench.layout.getLayout().regions.overlay.widgets[0]?.resource?.id).toBe("third");
    expect(latest?.()).toBe(true);
  } finally {
    stop();
    fixture.workbench.dispose();
  }
});
