import { expect, test } from "bun:test";
import * as Y from "yjs";
import { replaceText } from "./text-input";

test.each([
  ["😀 tail", "😃 tail"],
  ["x😀", `y${String.fromCodePoint(0x1fa00)}`],
])("keeps Unicode text intact when replacing %s with %s", (previous, next) => {
  const document = new Y.Doc();
  const text = document.getText("content");
  try {
    text.insert(0, previous);
    document.transact(() => replaceText(text, next));
    expect(text.toString()).toBe(next);
  } finally {
    document.destroy();
  }
});
