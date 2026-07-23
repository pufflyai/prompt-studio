import { describe, expect, test } from "bun:test";
import type { ResourceContextAction } from "@pstdio/ui";
import { mergeDataViewRowActions } from "./data-view";

const action = (key: string, label: string): ResourceContextAction => ({
  key,
  label,
  onClick: () => undefined,
});

describe("mergeDataViewRowActions", () => {
  test("keeps distinct actions that share a label", () => {
    const actions = mergeDataViewRowActions(
      [action("resource.archive", "Archive")],
      [action("contribution.archive", "Archive")],
    );

    expect(actions.map((item) => item.key)).toEqual(["resource.archive", "contribution.archive"]);
  });

  test("deduplicates the same action key", () => {
    const actions = mergeDataViewRowActions([action("archive", "Archive")], [action("archive", "Archive ticket")]);

    expect(actions.map((item) => item.key)).toEqual(["archive"]);
  });
});
