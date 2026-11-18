import { expect, test } from "bun:test";
import { createChatSession } from "./chat-session";

test("a burst of transcript patches paints once, while draft and control changes notify the view immediately", () => {
  const session = createChatSession({ query: async () => ({}), action: async () => undefined });
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  const request = globalThis.requestAnimationFrame;
  const cancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  };
  globalThis.cancelAnimationFrame = (id) => {
    frames.delete(id);
  };
  try {
    let paints = 0;
    const unsubscribe = session.subscribeToView(() => {
      paints++;
    });
    session.accept({ revision: 0, snapshot: { messages: [] } });
    expect(paints).toBe(1);
    const message = { id: "a", role: "assistant", parts: [{ type: "text", text: "First" }] };
    session.accept({ revision: 1, patch: { op: "add", path: "/messages/0", value: message } });
    session.accept({ revision: 2, patch: { op: "replace", path: "/messages/0", value: { ...message, parts: [] } } });
    expect(session.getSnapshot().messages[0]?.parts).toEqual([]);
    expect(paints).toBe(1);
    expect(frames.size).toBe(1);
    const paint = [...frames.values()][0]!;
    frames.clear();
    paint(0);
    expect(paints).toBe(2);
    session.accept({ revision: 3, patch: { op: "remove", path: "/messages/0" } });
    session.changeDraft({ text: "typing" });
    expect(paints).toBe(3);
    expect(frames.size).toBe(0);
    session.accept({ revision: 4, snapshot: { readOnly: true } });
    expect(paints).toBe(4);
    session.accept({ revision: 5, patch: { op: "add", path: "/messages/0", value: message } });
    unsubscribe();
    expect(frames.size).toBe(0);
    session.subscribeToView(() => {
      paints++;
    });
    session.accept({ revision: 6, patch: { op: "remove", path: "/messages/0" } });
    expect(frames.size).toBe(1);
    void session.dispose();
    expect(frames.size).toBe(0);
  } finally {
    globalThis.requestAnimationFrame = request;
    globalThis.cancelAnimationFrame = cancel;
  }
});
