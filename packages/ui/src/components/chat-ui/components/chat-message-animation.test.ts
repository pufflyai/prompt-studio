import { describe, expect, test } from "bun:test";
import { getNextMessageAnimationState, type MessageAnimationState } from "./chat-message-animation";

const advance = (state: MessageAnimationState, itemKeys: string[]) =>
  getNextMessageAnimationState({
    itemKeys,
    state,
  });

describe("chat message animation state", () => {
  test("does not animate messages on the initial render", () => {
    const next = advance({ initialized: false, seenKeys: new Set() }, ["user-1", "assistant-1"]);

    expect([...next.animatedKeys]).toEqual([]);
    expect([...next.state.seenKeys]).toEqual(["user-1", "assistant-1"]);
  });

  test("does not replay animations when hydrated messages return after a temporary count drop", () => {
    let state = advance({ initialized: false, seenKeys: new Set() }, ["user-1", "assistant-1", "user-2"]).state;

    const reconnecting = advance(state, ["user-2"]);
    expect([...reconnecting.animatedKeys]).toEqual([]);
    state = reconnecting.state;

    const hydrated = advance(state, ["user-1", "assistant-1", "user-2", "assistant-2"]);
    expect([...hydrated.animatedKeys]).toEqual(["assistant-2"]);
  });

  test("animates only newly appended messages after the list is mounted", () => {
    const state = advance({ initialized: false, seenKeys: new Set() }, ["user-1"]).state;
    const next = advance(state, ["user-1", "assistant-1"]);

    expect([...next.animatedKeys]).toEqual(["assistant-1"]);
  });
});
