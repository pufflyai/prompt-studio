import { describe, expect, mock, test } from "bun:test";
import {
  type AutoScrollState,
  getNextAutoScrollState,
  getNextReaderReturnState,
  scrollForNextAutoScrollState,
} from "./auto-scroll";

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

describe("returning to a conversation", () => {
  const away = (seenTail: string) => ({ reading: false, seenTail, returning: false });

  test("keeps the reading position when nothing changed while away", () => {
    const next = getNextReaderReturnState(away("m2"), true, "m2");
    expect(next.shouldScroll).toBe(false);
    expect(next.state.returning).toBe(true);
  });

  test("lands on the latest reply when it is already loaded on return", () => {
    expect(getNextReaderReturnState(away("m2"), true, "m3").shouldScroll).toBe(true);
  });

  test("lands on the latest reply once the returning conversation catches up", () => {
    const returned = getNextReaderReturnState(away("m2"), true, "m2").state;
    const caughtUp = getNextReaderReturnState(returned, true, "m3");
    expect(caughtUp).toEqual({ shouldScroll: true, state: { reading: true, seenTail: "m3", returning: false } });
  });

  test("never scrolls for new content while the reader stays on the conversation", () => {
    const reading = { reading: true, seenTail: "m2", returning: false };
    expect(getNextReaderReturnState(reading, true, "m3")).toEqual({
      shouldScroll: false,
      state: { reading: true, seenTail: "m3", returning: false },
    });
  });

  test("remembers what the reader saw when they leave", () => {
    const reading = { reading: true, seenTail: "m2", returning: false };
    expect(getNextReaderReturnState(reading, false, "m3").state).toEqual(away("m2"));
  });
});
