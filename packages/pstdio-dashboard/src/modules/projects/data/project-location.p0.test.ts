import { expect, test } from "bun:test";
import { projectLocationKey } from "./project-location";

test("unknown Cloud membership keeps a downloaded folder label neutral", () => {
  expect(projectLocationKey("/notes", { signedIn: true, cloud: false, membershipKnown: false })).toEqual({
    key: "path",
    path: "/notes",
  });
  expect(projectLocationKey("/notes", { signedIn: true, cloud: false, membershipKnown: true })).toEqual({
    key: "list.localPath",
    path: "/notes",
  });
});
