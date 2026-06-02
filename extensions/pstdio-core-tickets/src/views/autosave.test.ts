import { describe, expect, test } from "bun:test";
import { createContentAutosave } from "./autosave";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("createContentAutosave", () => {
  test("debounces saves and persists the latest content once", async () => {
    const saves: Array<[string, string]> = [];
    const autosave = createContentAutosave({ save: (id, content) => void saves.push([id, content]), delayMs: 10 });

    autosave.reset("t1", "initial");
    autosave.change("a");
    autosave.change("ab");
    expect(saves).toEqual([]);

    await wait(20);
    expect(saves).toEqual([["t1", "ab"]]);
  });

  test("does not save when content is unchanged", async () => {
    const saves: Array<[string, string]> = [];
    const autosave = createContentAutosave({ save: (id, content) => void saves.push([id, content]), delayMs: 10 });

    autosave.reset("t1", "initial");
    autosave.change("initial");

    await wait(20);
    expect(saves).toEqual([]);
  });

  test("flush persists immediately and cancels the pending debounce", async () => {
    const saves: Array<[string, string]> = [];
    const autosave = createContentAutosave({ save: (id, content) => void saves.push([id, content]), delayMs: 50 });

    autosave.reset("t1", "initial");
    autosave.change("edited");
    autosave.flush();
    expect(saves).toEqual([["t1", "edited"]]);

    await wait(60);
    expect(saves).toEqual([["t1", "edited"]]); // no duplicate from the cancelled timer
  });

  test("switching tickets flushes the previous ticket's pending edit", async () => {
    const saves: Array<[string, string]> = [];
    const autosave = createContentAutosave({ save: (id, content) => void saves.push([id, content]), delayMs: 50 });

    autosave.reset("t1", "one");
    autosave.change("one-edited");
    autosave.reset("t2", "two"); // navigates to a different ticket before the debounce fired

    expect(saves).toEqual([["t1", "one-edited"]]);
  });
});
