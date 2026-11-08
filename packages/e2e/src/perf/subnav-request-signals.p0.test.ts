import { expect, test } from "bun:test";
import { type SubnavFetchSignal, withSubnavClientAborts } from "./subnav-request-signals";

const url = "http://benchmark.test/v1/projects/project/extensions/commands/demo.tree.body/execute";
const request = { url, method: "POST", postData: { params: { one: 1 } }, startedMs: 100 };
const signal: SubnavFetchSignal = {
  url,
  method: "POST",
  postData: request.postData,
  started: 1099.9,
  preAborted: false,
  abort: { at: 1120, name: "AbortError", message: "The operation was aborted", signalAborted: true },
};

test("attributes a unique explicit client abort using browser request start, body and occurrence", () => {
  expect(withSubnavClientAborts([request], [signal], 1000)[0]).toMatchObject({
    ...request,
    clientAbort: { atMs: 120, name: "AbortError", signalAborted: true, preAborted: false },
  });
});

test("missing, different and ambiguous fetch occurrences cannot supply cancellation evidence", () => {
  for (const signals of [
    [],
    [{ ...signal, url: `${url}/different` }],
    [{ ...signal, method: "GET" }],
    [{ ...signal, postData: { params: { one: 2 } } }],
    [{ ...signal, started: 1101 }],
    [signal, { ...signal }],
    [signal, { ...signal, started: 1099.95, postData: undefined }],
  ])
    expect(withSubnavClientAborts([request], signals, 1000)[0]).not.toHaveProperty("clientAbort");
});

test("one fetch signal cannot excuse repeated requests and a later read keeps its own evidence", () => {
  const rows = withSubnavClientAborts([request, { ...request, startedMs: 200 }], [signal], 1000);
  expect(rows[0]).toHaveProperty("clientAbort");
  expect(rows[1]).not.toHaveProperty("clientAbort");
  const later = { ...signal, started: 1199.9, abort: { ...signal.abort!, at: 1220 } };
  expect(withSubnavClientAborts([request, { ...request, startedMs: 200 }], [signal, later], 1000)[1]).toMatchObject({
    clientAbort: { atMs: 220 },
  });
});
