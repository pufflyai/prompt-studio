import { expect, test } from "bun:test";
import * as Y from "yjs";
import { projectInfoState, readProjectInfo, writeProjectInfo } from "./project-info";

test("project composition converges alongside independent offline project name edits", () => {
  const one = new Y.Doc();
  const two = new Y.Doc();
  writeProjectInfo(one, { name: "Project" });
  Y.applyUpdate(two, projectInfoState(one));
  const composition = JSON.stringify({
    defaultPage: { kind: "page", extensionId: "example.space", id: "desk" },
    resourceOpeners: [],
  });
  writeProjectInfo(one, { composition });
  writeProjectInfo(two, { name: "Renamed project" });
  Y.applyUpdate(one, projectInfoState(two));
  Y.applyUpdate(two, projectInfoState(one));
  expect(readProjectInfo(one)).toEqual(readProjectInfo(two));
  expect(readProjectInfo(two)).toMatchObject({ name: "Renamed project", composition });
  one.destroy();
  two.destroy();
});
