import { describe, expect, test } from "bun:test";
import { pausedExtensions } from "./paused-extensions";

describe("paused extensions", () => {
  test("tells subscribers when an extension is paused and resumed", () => {
    const seen: boolean[] = [];
    const stop = pausedExtensions.subscribe(() => seen.push(pausedExtensions.get().has("shader")));

    pausedExtensions.pause("shader");
    pausedExtensions.pause("shader");
    pausedExtensions.resume("shader");
    stop();

    expect(seen).toEqual([true, false]);
  });
});
