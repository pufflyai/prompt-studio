import { expect, test } from "bun:test";
import type { Skill } from "@pstdio/sdk/resources";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import extension from "./extension";
import { commands } from "./src/browser";

const skill: Skill = {
  id: "skill-id",
  project_id: "project",
  name: "review",
  title: "Review",
  description: "Review a change",
  source_kind: "project",
  editable: true,
  files: [{ path: "SKILL.md", content: "# Review", encoding: "utf8" }],
  created_at: "",
  updated_at: "",
  deleted_at: null,
};
const context = () =>
  makeCommandContext({
    storage: createMemoryStorage(),
    projectId: "project",
    params: { name: "review" },
    overrides: { skills: { list: async () => [skill] } },
  });

test("opens the skill browser from the project navigation footer", () => {
  expect(extension.navigationItems?.find((item) => item.id === "skills")).toMatchObject({
    slot: "footer",
    owner: { id: "project", extensionId: "pstdio" },
    action: { kind: "page", page: { id: "skills" } },
  });
});

test("opens a project skill from its browser tree and reads its files through the CLI command", async () => {
  const tree = extension.views?.find((view) => view.id === "skill-list")?.body;
  if (tree?.kind !== "tree") throw new Error("Skills need a navigation tree");
  const sections = await tree.body(context());
  expect(sections[0]?.nodes[0]).toMatchObject({
    label: "Review",
    resource: { id: "review", projectId: "project" },
    target: { kind: "page", page: { id: "skill" }, resource: { id: "review" } },
  });
  const read = extension.commands?.find((command) => command.id === "read");
  expect(read?.cli).toBe(true);
  expect(await commands.read.run(context(), { name: "review" })).toEqual(skill);
});

test("selects the first skill when opening the browser without a selection", async () => {
  expect(await commands.read.run(context(), {})).toEqual(skill);
});

test("opens an empty browser when the project has no skills", async () => {
  const empty = makeCommandContext({
    storage: createMemoryStorage(),
    projectId: "project",
    params: {},
    overrides: { skills: { list: async () => [] } },
  });
  expect(await commands.read.run(empty, {})).toBeNull();
});
