import { expect, test } from "bun:test";
import { createFixture } from "./fixture";

test("setStatus updates one notification and returns it directly", async () => {
  const fixture = await createFixture();
  const notification = await fixture.apis.revised.notify.setStatus("review-1", "done");
  expect(notification?.id).toBe("review-1");
  expect(notification?.status).toBe("done");
  expect(fixture.notifications.get("review-2")?.status).toBe("open");
});

test("setStatusByKey updates the matching group and missing ID returns null", async () => {
  const fixture = await createFixture();
  const notifications = await fixture.apis.revised.notify.setStatusByKey("review", "dismissed");
  expect(notifications.map(({ id }) => id)).toEqual(["review-1", "review-2"]);
  expect(await fixture.apis.revised.notify.setStatus("missing", "done")).toBeNull();
});
