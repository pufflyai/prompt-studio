import { describe, expect, test } from "bun:test";
import { shouldOpenSessionsLocationResource } from "./sessions-browser-mode";

describe("shouldOpenSessionsLocationResource", () => {
  test("skips a location resource that is already open", () => {
    const resourceUri = "pstdio://projects/project-1/sessions/session-1";

    expect(shouldOpenSessionsLocationResource({ currentResourceUri: resourceUri, nextResourceUri: resourceUri })).toBe(
      false,
    );
  });

  test("opens a different location resource", () => {
    expect(
      shouldOpenSessionsLocationResource({
        currentResourceUri: "pstdio://projects/project-1/sessions/session-1",
        nextResourceUri: "pstdio://projects/project-1/sessions/session-2",
      }),
    ).toBe(true);
  });

  test("skips missing location resources", () => {
    expect(
      shouldOpenSessionsLocationResource({
        currentResourceUri: "pstdio://projects/project-1/sessions/session-1",
        nextResourceUri: null,
      }),
    ).toBe(false);
  });
});
