import { describe, expect, mock, test } from "bun:test";
import { type AutoScrollState, getNextAutoScrollState, scrollForNextAutoScrollState } from "./auto-scroll";

const advanceAutoScroll = (state: AutoScrollState, userMessageCount: number) =>
  getNextAutoScrollState({
    state,
    conversationKey: "session-1",
    userMessageCount,
  });

describe("auto-scroll state", () => {
  test("uses an instant scroll when a follow-up user message is detected", () => {
    const scrollToBottom = mock();

    const next = scrollForNextAutoScrollState({
      state: {
        conversationKey: "session-1",
        userMessageCount: 10,
      },
      conversationKey: "session-1",
      userMessageCount: 11,
      scrollToBottom,
    });

    expect(scrollToBottom).toHaveBeenCalledWith("instant");
    expect(next.state).toEqual({
      conversationKey: "session-1",
      userMessageCount: 11,
    });
  });

  test("does not replay scroll when a pending follow-up hydrates after a temporary count drop", () => {
    let state: AutoScrollState = {
      conversationKey: "session-1",
      userMessageCount: 10,
    };

    const pending = advanceAutoScroll(state, 11);
    expect(pending.shouldScroll).toBe(true);
    state = pending.state;

    const reconnecting = advanceAutoScroll(state, 1);
    expect(reconnecting.shouldScroll).toBe(false);
    state = reconnecting.state;

    const hydrated = advanceAutoScroll(state, 11);
    expect(hydrated.shouldScroll).toBe(false);
  });

  test("resets the baseline when the conversation changes", () => {
    const next = getNextAutoScrollState({
      state: {
        conversationKey: "session-1",
        userMessageCount: 10,
      },
      conversationKey: "session-2",
      userMessageCount: 12,
    });

    expect(next.shouldScroll).toBe(false);
    expect(next.state).toEqual({
      conversationKey: "session-2",
      userMessageCount: 12,
    });
  });
});
