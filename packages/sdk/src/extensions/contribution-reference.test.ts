import { describe, expect, test } from "bun:test";
import { commandRefId, contributionRefId } from "./contribution-reference";

describe("contributionRefId", () => {
  test("keeps the registered id of a host ref", () => {
    expect(contributionRefId({ extensionId: "pstdio", kind: "view", id: "explorer" })).toBe("explorer");
  });

  test("prefixes an extension ref with its owner and kind", () => {
    expect(contributionRefId({ extensionId: "acme.boards", kind: "view", id: "board" })).toBe("acme.boards.view.board");
  });

  test("gives a ref without an extension id to the owning extension", () => {
    expect(contributionRefId({ kind: "mode", id: "focus" }, "acme.boards")).toBe("acme.boards.mode.focus");
  });

  test("treats a ref without an extension id or owner as a host ref", () => {
    expect(contributionRefId({ kind: "mode", id: "focus" })).toBe("focus");
  });
});

describe("commandRefId", () => {
  test("uses the command kind", () => {
    expect(commandRefId({ extensionId: "acme.boards", id: "open" })).toBe("acme.boards.command.open");
    expect(commandRefId({ extensionId: "pstdio", id: "workbench.open" })).toBe("workbench.open");
  });
});
