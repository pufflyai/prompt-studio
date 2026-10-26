import { expect, test } from "bun:test";
import { rendererPagePosition } from "./renderer-page-position";

const accepted = { offset: 0, page: { revision: "r1", cursor: "after-100" } };
test("only a page immediately after the accepted result reuses its cursor", () => {
  expect(rendererPagePosition("scope", 100, 100, accepted)).toEqual({
    identity: "scope",
    offset: 100,
    revision: "r1",
    cursor: "after-100",
  });
  expect(rendererPagePosition("scope", 200, 100, accepted)).toEqual({
    identity: "scope",
    offset: 200,
    revision: "r1",
    cursor: undefined,
  });
  expect(rendererPagePosition("scope", 0, 100, { ...accepted, offset: 200 })).toEqual({
    identity: "scope",
    offset: 0,
    revision: "r1",
    cursor: undefined,
  });
});
