import { expect, test } from "bun:test";
import type { ExtensionViewRenderContext } from "@pstdio/sdk/extensions";
import { artifactRevisionChoices, olderVersionsChoice, revisionChoicePrefix } from "./artifact-revision-choices";

const t: ExtensionViewRenderContext["t"] = (_key, fallback = "", args) =>
  fallback.replace("{{number}}", String(args?.number));

test("saved revision captions stay valid for blank and very long publication labels", () => {
  const { choices } = artifactRevisionChoices(
    [
      { id: "latest", label: "a".repeat(2000) },
      { id: "blank", label: " \n " },
    ],
    "blank",
    0,
    t,
  );
  expect(choices[0].label).toHaveLength(1000);
  expect(choices[0].label.endsWith("… · Latest")).toBe(true);
  expect(choices[1].label).toBe("Version 1");
  expect(choices[1].selected).toBe(true);
});

test("every revision in a large history remains reachable while the saved selection stays checked", () => {
  const revisions = Array.from({ length: 2051 }, (_, id) => ({ id: String(id), label: `Saved ${id}` }));
  const reached = new Set<string>();
  const selected = "2042";
  const { lastPage } = artifactRevisionChoices(revisions, selected, 0, t);
  for (let page = 0; page <= lastPage; page++) {
    const result = artifactRevisionChoices(revisions, selected, page, t);
    expect(result.page).toBe(page);
    expect(result.choices.length).toBeLessThanOrEqual(103);
    expect(result.choices.filter((choice) => choice.selected).map((choice) => choice.id)).toEqual([
      revisionChoicePrefix + selected,
    ]);
    for (const choice of result.choices) {
      if (choice.kind !== "action") reached.add(choice.id);
      else expect(choice.closeOnSelect).toBe(false);
    }
    expect(result.choices.find((choice) => choice.id === olderVersionsChoice)?.disabled).toBe(page === lastPage);
  }
  expect(reached.size).toBe(revisions.length);
  expect(artifactRevisionChoices(revisions, selected, 99, t).page).toBe(lastPage);
  expect(artifactRevisionChoices([], undefined, 4, t).choices).toEqual([]);
});
