import { describe, expect, test } from "bun:test";
import { notificationStatusRouteVerb } from "./notification-transition-route";

describe("notificationStatusRouteVerb", () => {
  test("maps dismissed status to the dismiss route verb", () => {
    expect(notificationStatusRouteVerb("dismissed")).toBe("dismiss");
  });

  test("keeps done status as the done route verb", () => {
    expect(notificationStatusRouteVerb("done")).toBe("done");
  });
});
