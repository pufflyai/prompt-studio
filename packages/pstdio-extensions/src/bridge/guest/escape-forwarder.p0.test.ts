import { expect, test } from "bun:test";
import { installEscapeForwarder } from "./escape-forwarder";

const escapeEvent = () =>
  Object.assign(new Event("keydown", { cancelable: true }), {
    key: "Escape",
    code: "Escape",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
  });

test("an unhandled guest Escape reaches the host after guest handlers", async () => {
  const target = new EventTarget();
  const forwarded: Array<string | undefined> = [];
  installEscapeForwarder(target, async (event) => {
    forwarded.push(event.key);
  });
  target.dispatchEvent(escapeEvent());
  expect(forwarded).toEqual([]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(forwarded).toEqual(["Escape"]);
});

test("a guest dialog can consume Escape without closing the host presentation", async () => {
  const target = new EventTarget();
  let forwarded = 0;
  installEscapeForwarder(target, async () => {
    forwarded++;
  });
  target.addEventListener("keydown", (event) => event.preventDefault());
  target.dispatchEvent(escapeEvent());
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(forwarded).toBe(0);
});
