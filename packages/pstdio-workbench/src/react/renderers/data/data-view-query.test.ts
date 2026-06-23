import { describe, expect, test } from "bun:test";
import { createDataViewQuerySequencer } from "./data-view-query";

describe("createDataViewQuerySequencer", () => {
  test("only treats the most recent query as current", () => {
    const sequencer = createDataViewQuerySequencer();

    const first = sequencer.next();
    const second = sequencer.next();

    expect(sequencer.isLatest(first)).toBe(false);
    expect(sequencer.isLatest(second)).toBe(true);
  });
});
