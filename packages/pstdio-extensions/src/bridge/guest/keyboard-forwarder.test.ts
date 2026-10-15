import { expect, test } from "bun:test";
import { installGuestKeyboardForwarder } from "./keyboard-forwarder";

const keyEvent = (key: string, modifiers: Partial<KeyboardEventInit> = {}) =>
  Object.assign(new Event("keydown", { cancelable: true }), { key, ...modifiers }) as KeyboardEvent;

test("unhandled Escape forwards after guest handlers, including from editable content", async () => {
  const target = new EventTarget();
  const forwarded: KeyboardEventInit[] = [];
  installGuestKeyboardForwarder(
    target,
    async (event) => {
      forwarded.push(event);
    },
    () => true,
  );
  target.dispatchEvent(keyEvent("Escape"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(forwarded.map((event) => event.key)).toEqual(["Escape"]);
});

test("guest menu and dialog handlers consume Escape before the host receives it", async () => {
  const target = new EventTarget();
  const forwarded: KeyboardEventInit[] = [];
  installGuestKeyboardForwarder(
    target,
    async (event) => {
      forwarded.push(event);
    },
    () => false,
  );
  target.addEventListener("keydown", (event) => event.preventDefault());
  target.dispatchEvent(keyEvent("Escape"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(forwarded).toEqual([]);
});

test("ordinary typing stays in the guest and existing modified shortcuts keep their policy", async () => {
  const target = new EventTarget();
  const forwarded: KeyboardEventInit[] = [];
  installGuestKeyboardForwarder(
    target,
    async (event) => {
      forwarded.push(event);
    },
    () => true,
  );
  target.dispatchEvent(keyEvent("a"));
  target.dispatchEvent(keyEvent("p", { ctrlKey: true }));
  target.dispatchEvent(keyEvent("p", { ctrlKey: true, shiftKey: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(forwarded.map((event) => event.key)).toEqual(["p"]);
});
