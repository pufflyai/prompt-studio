import { expect, test } from "bun:test";
import { acceptanceConditions, draftChapterFor } from "./forms";

test("authoring accepts an optional list of conditions", () => {
  expect(acceptanceConditions("")).toEqual([]);
  expect(acceptanceConditions("Users can save work\nUsers can reopen work")).toEqual([
    { statement: "Users can save work", tests: [] },
    { statement: "Users can reopen work", tests: [] },
  ]);
});

test("finding and chapter forms retain ownership of existing draft slots", () => {
  const drafts = [
    { chapter: -1, title: "Archived observation" },
    { chapter: -2, title: "Finding" },
    { chapter: -3, title: "Chapter" },
  ];
  expect(drafts.find((draft) => draft.chapter === draftChapterFor("finding", 1))?.title).toBe("Finding");
  expect(drafts.find((draft) => draft.chapter === draftChapterFor("chapter", 1))?.title).toBe("Chapter");
});
