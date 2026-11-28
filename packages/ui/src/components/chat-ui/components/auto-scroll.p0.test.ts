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
  const leave = (tail: string) => getNextReaderReturnState({ reading: true, seenTail: tail }, false, tail).state;

  test("keeps the reading position when nothing changed while away", () => {
    expect(getNextReaderReturnState(leave("m2:1"), true, "m2:1").shouldScroll).toBe(false);
  });

  test("lands on the latest reply when a message arrived while away", () => {
    const away = getNextReaderReturnState(leave("m2:1"), false, "m3:1").state;
    expect(getNextReaderReturnState(away, true, "m3:1").shouldScroll).toBe(true);
  });

  test("lands on the latest reply when the last reply grew while away", () => {
    expect(getNextReaderReturnState(leave("m2:1"), true, "m2:4").shouldScroll).toBe(true);
  });

  test("never scrolls while the reader stays on the conversation", () => {
    const reading = { reading: true, seenTail: "m2:1" };
    expect(getNextReaderReturnState(reading, true, "m3:1")).toEqual({
      shouldScroll: false,
      state: { reading: true, seenTail: "m3:1" },
    });
  });
});
