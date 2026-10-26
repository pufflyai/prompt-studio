import { expect, test } from "bun:test";
import { measureSubnavRequests } from "./subnav-resource-clock";

const request = (startTime: number, responseEnd: number, url = "https://benchmark.test/tree") => ({
  url,
  elapsedMs: responseEnd,
  timing: {
    startTime,
    domainLookupStart: 0,
    domainLookupEnd: 0,
    connectStart: 0,
    secureConnectionStart: 0,
    connectEnd: 0,
    requestStart: 0,
    responseStart: 0,
    responseEnd,
  },
});

test("request completion uses the browser click clock despite protocol wall-clock disagreement", () => {
  const requests = [request(1_301_000, 126.6)];
  const resources = [{ name: requests[0].url, responseEnd: 1_333 }];

  expect(measureSubnavRequests(requests, resources, 1_000)).toEqual([{ durationMs: 126.6, completedMs: 333 }]);
});

test("matches every repeated request and keeps unrelated resources outside the measurement", () => {
  const requests = [request(1, 100), request(999_999, 200)];
  const resources = [
    { name: "https://benchmark.test/asset.js", responseEnd: 9_999 },
    { name: requests[0].url, responseEnd: 1_100 },
    { name: requests[1].url, responseEnd: 1_500 },
  ];
  expect(measureSubnavRequests(requests, resources, 1_000)).toEqual([
    { durationMs: 100, completedMs: 100 },
    { durationMs: 200, completedMs: 500 },
  ]);
});

test("missing or ambiguous browser timings fail instead of dropping requests", () => {
  const requests = [request(1, 100)];
  expect(() => measureSubnavRequests(requests, [], 1_000)).toThrow("Missing browser resource timing");
  expect(() =>
    measureSubnavRequests(
      requests,
      [
        { name: requests[0].url, responseEnd: 1_100 },
        { name: requests[0].url, responseEnd: 1_200 },
      ],
      1_000,
    ),
  ).toThrow("recorded request count");
});
