import { expect, test } from "bun:test";
import { installKeyboardShortcuts } from "./keyboard-shortcuts";

const keydown = (key: string, input: Record<string, unknown> = {}) =>
  Object.assign(new Event("keydown", { cancelable: true }), {
    key,
    code: key === " " ? "Space" : `Key${key.toUpperCase()}`,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    ...input,
  });
const leader = { id: "leader", key: "Space", altKey: true, shiftKey: true };

test("Option letter shortcuts resolve macOS symbols and dead keys to the intended action", () => {
  const target = new EventTarget();
  const requests: unknown[] = [];
  installKeyboardShortcuts(
    target,
    () => [
      { id: "pin", key: "I", altKey: true, shiftKey: true },
      { id: "bottom", key: "B", altKey: true, shiftKey: true },
      { id: "side", key: "E", altKey: true, shiftKey: true },
    ],
    (request) => requests.push(request),
  );
  for (const [key, code] of [
    ["ı", "KeyB"],
    ["´", "KeyE"],
    ["Dead", "KeyE"],
  ] as const) {
    const event = keydown(key, { code, altKey: true, shiftKey: true });
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  }
  expect(requests).toEqual([
    { id: "bottom", repeat: false },
    { id: "side", repeat: false },
    { id: "side", repeat: false },
  ]);
});

test("Option letter shortcuts preserve layout letters and leave composition and AltGraph local", () => {
  const target = new EventTarget();
  const requests: unknown[] = [];
  installKeyboardShortcuts(
    target,
    () => [{ id: "layout-q", key: "Q", altKey: true, shiftKey: true }],
    (request) => requests.push(request),
  );
  target.dispatchEvent(keydown("Q", { code: "KeyA", altKey: true, shiftKey: true }));
  for (const extra of [{ isComposing: true }, { getModifierState: () => true }]) {
    const event = keydown("œ", { code: "KeyQ", altKey: true, shiftKey: true, ...extra });
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  }
  expect(requests).toEqual([{ id: "layout-q", repeat: false }]);
});

test("Option-modified Space opens the keyboard menu when macOS emits a non-breaking space", () => {
  const target = new EventTarget();
  const requests: unknown[] = [];
  installKeyboardShortcuts(
    target,
    () => [leader],
    (request) => requests.push(request),
  );
  const event = keydown("\u00a0", { code: "Space", altKey: true, shiftKey: true });
  target.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(requests).toEqual([{ id: "leader", repeat: false }]);
});

test("an owned entry chord is consumed before a guest editor and delivered once", () => {
  const target = new EventTarget();
  const requests: unknown[] = [];
  const dispose = installKeyboardShortcuts(
    target,
    () => [leader],
    (request) => {
      requests.push(request);
    },
  );
  let editorCalls = 0;
  target.addEventListener("keydown", () => editorCalls++);
  const event = keydown(" ", { altKey: true, shiftKey: true });
  target.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(editorCalls).toBe(0);
  expect(requests).toEqual([{ id: "leader", repeat: false }]);
  dispose();
  target.dispatchEvent(keydown(" ", { altKey: true, shiftKey: true }));
  expect(editorCalls).toBe(1);
});

test("typing, local arrows, composition, and unowned modifiers remain with the guest", () => {
  const target = new EventTarget();
  const requests: unknown[] = [];
  installKeyboardShortcuts(
    target,
    () => [leader],
    (request) => {
      requests.push(request);
    },
  );
  for (const event of [
    keydown("a"),
    keydown("ArrowRight"),
    keydown("z", { ctrlKey: true }),
    keydown(" ", { altKey: true, shiftKey: true, isComposing: true }),
    keydown(" ", { ctrlKey: true, altKey: true, shiftKey: true }),
  ]) {
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  }
  expect(requests).toEqual([]);
});

test("effective chord updates and repeated key metadata follow the host profile", () => {
  const target = new EventTarget();
  let profile = [leader];
  const requests: unknown[] = [];
  installKeyboardShortcuts(
    target,
    () => profile,
    (request) => {
      requests.push(request);
    },
  );
  profile = [{ id: "leader", key: "K", altKey: true, shiftKey: false }];
  const old = keydown(" ", { altKey: true, shiftKey: true });
  target.dispatchEvent(old);
  expect(old.defaultPrevented).toBe(false);
  target.dispatchEvent(keydown("k", { altKey: true, repeat: true }));
  expect(requests).toEqual([{ id: "leader", repeat: true }]);
});

test("numbered tab chords match shifted digit keys without consuming AltGraph input", () => {
  const target = new EventTarget();
  const requests: unknown[] = [];
  installKeyboardShortcuts(
    target,
    () => [{ id: "tab4", key: "4", altKey: true, shiftKey: true }],
    (request) => requests.push(request),
  );
  target.dispatchEvent(keydown("$", { code: "Digit4", altKey: true, shiftKey: true }));
  target.dispatchEvent(keydown("4", { code: "Digit4", altKey: true, shiftKey: true, getModifierState: () => true }));
  expect(requests).toEqual([{ id: "tab4", repeat: false }]);
});
