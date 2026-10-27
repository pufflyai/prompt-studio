import { expect, test } from "bun:test";
import * as Y from "yjs";
import { createMarkdownTextDocument } from "./markdown-text-document";

const clone = (document: Y.Doc) => {
  const next = new Y.Doc();
  Y.applyUpdate(next, Y.encodeStateAsUpdate(document));
  return next;
};

test("composition defers remote rendering without overwriting a concurrent remote edit", () => {
  const first = new Y.Doc();
  first.getText("content").insert(0, "first\nlast");
  const second = clone(first);
  const left = createMarkdownTextDocument(first);
  const right = createMarkdownTextDocument(second);
  const rendered: string[] = [];
  const origins: string[] = [];
  right.subscribe((source, origin) => {
    rendered.push(source);
    origins.push(origin);
  });
  right.setComposing(true);
  left.write("FIRST\nlast");
  Y.applyUpdate(second, Y.encodeStateAsUpdate(first));
  expect(right.text.toString()).toBe("first\nlast");
  expect(rendered).toEqual([]);
  right.write("first\nLAST");
  expect(right.text.toString()).toBe("first\nLAST");
  right.setComposing(false);
  expect(right.text.toString()).toBe("FIRST\nLAST");
  expect(rendered).toEqual(["FIRST\nLAST"]);
  Y.applyUpdate(first, Y.encodeStateAsUpdate(second));
  expect(left.text.toString()).toBe("FIRST\nLAST");
  right.undo();
  expect(right.text.toString()).toBe("FIRST\nlast");
  Y.applyUpdate(first, Y.encodeStateAsUpdate(second));
  expect(left.text.toString()).toBe("FIRST\nlast");
  right.redo();
  expect(right.text.toString()).toBe("FIRST\nLAST");
  expect(origins).toEqual(["composition", "history", "history"]);
  left.destroy();
  right.destroy();
  first.destroy();
  second.destroy();
});

test("disposal stops incoming document notifications", () => {
  const document = new Y.Doc();
  const binding = createMarkdownTextDocument(document);
  let calls = 0;
  binding.subscribe(() => calls++);
  binding.destroy();
  document.getText("content").insert(0, "later");
  expect(calls).toBe(0);
  document.destroy();
});

test("tentative composition text is published only when the completed text can travel together", () => {
  const first = new Y.Doc();
  first.getText("content").insert(0, "base");
  const second = clone(first);
  const left = createMarkdownTextDocument(first);
  const right = createMarkdownTextDocument(second);
  right.setComposing(true);
  right.write("base編");
  expect(second.getText("content").toString()).toBe("base");
  Y.applyUpdate(first, Y.encodeStateAsUpdate(second));
  left.write(`${left.text.toString()} (remote)`);
  Y.applyUpdate(second, Y.encodeStateAsUpdate(first));
  right.write("base編集");
  right.setComposing(false);
  Y.applyUpdate(first, Y.encodeStateAsUpdate(second));
  expect(right.text.toString()).toMatch(/^base(?:編集 \(remote\)| \(remote\)編集)$/);
  expect(left.text.toString()).toBe(right.text.toString());
  left.destroy();
  right.destroy();
  first.destroy();
  second.destroy();
});

test("one committed composition is one undo step even after a pause", async () => {
  const shared = new Y.Doc();
  shared.getText("content").insert(0, "start");
  const binding = createMarkdownTextDocument(shared);
  binding.setComposing(true);
  binding.write("start 編");
  await new Promise((resolve) => setTimeout(resolve, 600));
  binding.write("start 編集");
  binding.setComposing(false);
  expect(shared.getText("content").toString()).toBe("start 編集");
  binding.undo();
  expect(shared.getText("content").toString()).toBe("start");
  binding.redo();
  expect(shared.getText("content").toString()).toBe("start 編集");
  binding.destroy();
  shared.destroy();
});

test("cancelled composition refreshes source positions without publishing tentative history", () => {
  const shared = new Y.Doc();
  shared.getText("content").insert(0, "abcdef");
  const before = Y.encodeStateAsUpdate(shared);
  const binding = createMarkdownTextDocument(shared);
  const notifications: string[] = [];
  binding.subscribe((source, origin) => notifications.push(`${origin}:${source}`));
  binding.setComposing(true);
  binding.write("abXdef");
  binding.write("abcdef");
  binding.setComposing(false);
  expect(notifications).toEqual(["remote:abcdef"]);
  expect(Y.encodeStateAsUpdate(shared)).toEqual(before);
  binding.destroy();
  shared.destroy();
});
