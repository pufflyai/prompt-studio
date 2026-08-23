import { describe, expect, test } from "bun:test";
import extension from "./extension";

describe("local example extension", () => {
  test("shows a notification when the hello command runs", async () => {
    const notices: unknown[] = [];

    const result = await extension.commands?.hello?.run({
      notify: {
        toast: async (notice) => {
          notices.push(notice);
        },
      },
      params: {},
    } as never);

    expect(result).toEqual({ message: "The repo-local extension is running." });
    expect(notices).toEqual([
      {
        message: "The repo-local extension is running.",
        title: "Local Example",
        type: "info",
      },
    ]);
  });
});
