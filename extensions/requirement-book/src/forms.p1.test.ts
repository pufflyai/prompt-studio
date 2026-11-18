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

test("editing acceptance keeps the test references on unchanged conditions", () => {
  const previous = [
    { statement: "Users can save work", tests: ["save.p1.test.ts"] },
    { statement: "Users can reopen work", tests: ["reopen.p1.test.ts"] },
  ];
  expect(acceptanceConditions("Users can reopen work\nUsers can publish work", previous)).toEqual([
    previous[1],
    { statement: "Users can publish work", tests: [] },
  ]);

  const multiline = [{ statement: "Save the draft\nRetain its attachments", tests: ["draft.p1.test.ts"] }];
  expect(acceptanceConditions(multiline[0].statement, multiline)).toEqual(multiline);
});
