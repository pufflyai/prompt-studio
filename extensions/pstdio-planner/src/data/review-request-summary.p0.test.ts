import { expect, test } from "bun:test";
import { reviewRequestSummary } from "./review-request-summary";
import type { ReviewRequestView } from "./review-request-types";

const request = (state: ReviewRequestView["state"]) => ({ state });

test("request counts follow open requests until every request is resolved", () => {
  expect(reviewRequestSummary({ requests: [], errors: [] })).toBeNull();
  expect(
    reviewRequestSummary({ requests: [request("open"), request("open"), request("answered")], errors: [] }),
  ).toMatchObject({
    count: 2,
    color: "orange",
  });
  expect(reviewRequestSummary({ requests: [request("answered"), request("cancelled")], errors: [] })).toMatchObject({
    count: 2,
    color: "green",
  });
});

test("an unreadable request keeps the count in need of attention", () => {
  expect(reviewRequestSummary({ requests: [request("answered")], errors: ["Unreadable request"] })).toMatchObject({
    count: 1,
    color: "orange",
  });
});
