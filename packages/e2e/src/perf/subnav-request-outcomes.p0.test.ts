import { expect, test } from "bun:test";
import { classifySubnavRequests, type SubnavObservedRequest } from "./subnav-request-outcomes";

const postData = (label = "Ticket", overrides: Record<string, unknown> = {}) => ({
  projectId: "project",
  slot: {
    id: "planner.ticket-files",
    kind: "renderer",
    context: { projectId: "project", treeId: "planner.ticket-files" },
  },
  resource: { extensionId: "planner", projectId: "project", type: "ticket", id: "one", label },
  params: {
    renderer: {
      rendererId: "planner.ticket-files",
      projectId: "project",
      modeId: "project",
      resource: { extensionId: "planner", projectId: "project", type: "ticket", id: "one", label },
    },
    state: { expandedNodeIds: ["files"] },
    ...overrides,
  },
});
const request = (overrides: Partial<SubnavObservedRequest> = {}): SubnavObservedRequest => ({
  path: "/v1/projects/project/extensions/commands/planner.view.ticket-files.tree.body/execute",
  url: "https://benchmark.test/v1/projects/project/extensions/commands/planner.view.ticket-files.tree.body/execute",
  method: "POST",
  startedMs: 100,
  durationMs: 50,
  completedMs: 150,
  postData: postData(),
  status: 200,
  outcomeOk: true,
  ...overrides,
});
const aborted = (overrides: Partial<SubnavObservedRequest> = {}) =>
  request({
    failure: "net::ERR_ABORTED",
    status: undefined,
    outcomeOk: undefined,
    clientAbort: {
      url: request().url,
      method: "POST",
      postData: postData(),
      fetchStartedMs: 99.9,
      atMs: 130,
      name: "AbortError",
      message: "The operation was aborted",
      signalAborted: true,
      preAborted: false,
    },
    ...overrides,
  });
const replacement = (overrides: Partial<SubnavObservedRequest> = {}) =>
  request({ startedMs: 140, completedMs: 220, postData: postData("Resolved ticket"), ...overrides });

test("a superseded bound-resource read retains its abort, payload and timing while its latest result succeeds", () => {
  const original = aborted();
  const latest = replacement();
  const result = classifySubnavRequests([original, latest]);
  expect(result.errors).toEqual([]);
  expect(result.requests).toEqual([{ ...original, supersededBy: 1 }, latest]);
  expect(original).not.toHaveProperty("supersededBy");
  expect(result.requests.map(({ completedMs }) => completedMs)).toEqual([150, 220]);
});

test("unmatched aborts, unproven retries and other transport failures remain errors", () => {
  for (const rows of [
    [aborted()],
    [aborted({ clientAbort: undefined }), replacement({ postData: postData() })],
    [request({ failure: "net::ERR_CONNECTION_RESET" }), replacement()],
    [aborted(), replacement({ postData: undefined })],
    [aborted(), replacement({ startedMs: 90 })],
    [aborted(), replacement({ status: 500 })],
    [aborted(), replacement({ outcomeOk: false })],
    [aborted(), replacement({ outcomeOk: undefined })],
    [aborted(), replacement(), replacement({ startedMs: 200, status: 503 })],
  ])
    expect(classifySubnavRequests(rows).errors).toContainEqual(rows[0]);
});

test("another read owner or navigation cannot excuse an aborted request", () => {
  const renderer = postData("Resolved").params.renderer;
  for (const payload of [
    { ...postData("Resolved"), projectId: "another-project" },
    postData("Resolved", { renderer: { ...renderer, rendererId: "another-renderer" } }),
    postData("Resolved", { renderer: { ...renderer, modeId: "another-mode" } }),
    postData("Resolved", { renderer: { ...renderer, pageParams: { page: "other" } } }),
    postData("Resolved", { renderer: { ...renderer, resource: { ...renderer.resource, id: "two" } } }),
    postData("Resolved", { pageParams: { page: "other" } }),
    postData("Resolved", { filter: "other" }),
    postData("Resolved", { node: { id: "other" } }),
    postData("Resolved", { state: { expandedNodeIds: ["other"] } }),
  ])
    expect(classifySubnavRequests([aborted(), replacement({ postData: payload })]).errors).toContainEqual(aborted());
  expect(classifySubnavRequests([aborted(), replacement({ path: "/other/tree.body/execute" })]).errors).toHaveLength(1);
  expect(classifySubnavRequests([request({ ...aborted(), startedMs: -1 }), replacement()]).errors).toHaveLength(1);
});

test("only tree read supersession qualifies and every ordinary HTTP and command failure blocks", () => {
  const diff = request({ path: "/v1/workspaces/one/diff-summary", failure: "net::ERR_ABORTED" });
  expect(classifySubnavRequests([diff, replacement({ path: diff.path })]).errors).toEqual([diff]);
  for (const invalid of [request({ status: 500 }), request({ status: undefined }), request({ outcomeOk: false })])
    expect(classifySubnavRequests([invalid]).errors).toEqual([invalid]);
});

test("missing or malformed ownership context fails closed", () => {
  for (const payload of [
    null,
    [],
    {},
    { ...postData(), params: {} },
    { ...postData(), resource: undefined },
    postData("Resolved", { renderer: undefined }),
    postData("Resolved", { renderer: { ...postData().params.renderer, resource: undefined } }),
    postData("Resolved", { renderer: { ...postData().params.renderer, projectId: "other" } }),
    postData("Resolved", { renderer: { ...postData().params.renderer, resource: { id: "one", type: 1 } } }),
  ])
    expect(classifySubnavRequests([aborted(), replacement({ postData: payload })]).errors).toContainEqual(aborted());
});

test("a chain of supersessions requires the latest matching owner to succeed", () => {
  const middle = replacement({
    failure: "net::ERR_ABORTED",
    status: undefined,
    outcomeOk: undefined,
    clientAbort: { ...aborted().clientAbort!, postData: postData("Resolved ticket"), fetchStartedMs: 139.9, atMs: 180 },
  });
  const latest = replacement({ startedMs: 200, completedMs: 260, postData: postData("Latest ticket") });
  const result = classifySubnavRequests([aborted(), middle, latest]);
  expect(result.errors).toEqual([]);
  expect(result.requests.map(({ supersededBy }) => supersededBy)).toEqual([2, 2, undefined]);
  expect(classifySubnavRequests([aborted(), middle]).errors).toHaveLength(2);
  expect(
    classifySubnavRequests([aborted({ clientAbort: undefined }), replacement({ postData: postData() }), latest]).errors,
  ).toContainEqual(aborted({ clientAbort: undefined }));
  for (const clock of [Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(classifySubnavRequests([aborted(), replacement({ startedMs: clock })]).errors).toContainEqual(aborted());
    expect(classifySubnavRequests([aborted(), replacement({ completedMs: clock })]).errors).toContainEqual(aborted());
    expect(classifySubnavRequests([request({ ...aborted(), startedMs: clock }), latest]).errors).toHaveLength(1);
  }
});

test("project-scoped tree replacement requires explicit in-flight client cancellation", () => {
  const wire = postData();
  const { projectId: _project, resource: _resource, ...body } = wire;
  const { resource: _bound, ...renderer } = body.params.renderer;
  const payload = { ...body, params: { ...body.params, renderer } };
  const first = aborted({ postData: payload, clientAbort: { ...aborted().clientAbort!, postData: payload } });
  const latest = replacement({ postData: payload });
  const result = classifySubnavRequests([first, latest]);
  expect(result.errors).toEqual([]);
  expect(result.requests[0]).toMatchObject({ failure: "net::ERR_ABORTED", supersededBy: 1 });
  expect(classifySubnavRequests([{ ...first, clientAbort: undefined }, latest]).errors).toHaveLength(1);
});

test("timeout, synthetic, pre-aborted, mismatched and invalid signal evidence remains blocking", () => {
  const proof = aborted().clientAbort!;
  for (const clientAbort of [
    undefined,
    { ...proof, name: "TimeoutError" },
    { ...proof, signalAborted: false },
    { ...proof, preAborted: true },
    { ...proof, atMs: 99 },
    { ...proof, atMs: 151 },
    { ...proof, atMs: Number.NaN },
    { ...proof, fetchStartedMs: -1 },
    { ...proof, url: `${proof.url}/another` },
    { ...proof, postData: postData("Other") },
  ])
    expect(classifySubnavRequests([aborted({ clientAbort }), replacement()]).errors).toHaveLength(1);
  expect(classifySubnavRequests([aborted(), replacement({ startedMs: 129 })]).errors).toHaveLength(1);
});

test("an already running duplicate does not obscure a later post-cancellation replacement", () => {
  const original = aborted();
  const overlapping = replacement({ startedMs: 129, completedMs: 170 });
  const fresh = replacement({ startedMs: 180, completedMs: 240 });
  const result = classifySubnavRequests([original, overlapping, fresh]);
  expect(result.errors).toEqual([]);
  expect(result.requests).toEqual([{ ...original, supersededBy: 2 }, overlapping, fresh]);
  // An overlapping copy alone cannot prove a replacement after cancellation.
  expect(classifySubnavRequests([original, overlapping]).errors).toContainEqual(original);
  // Other owners and failed latest reads cannot provide that proof.
  expect(
    classifySubnavRequests([
      original,
      overlapping,
      replacement({ startedMs: 180, postData: postData("Other", { filter: "other" }) }),
    ]).errors,
  ).toContainEqual(original);
  expect(classifySubnavRequests([original, overlapping, { ...fresh, outcomeOk: false }]).errors).toContainEqual(
    original,
  );
  // A separate failed copy remains visible even when the original was superseded.
  const failed = { ...overlapping, failure: "net::ERR_CONNECTION_RESET", status: undefined, outcomeOk: undefined };
  expect(classifySubnavRequests([original, failed, fresh]).errors).toEqual([failed]);
});

test("malformed same-owner chronology cannot be skipped to find a later successful replacement", () => {
  for (const intervening of [
    replacement({ startedMs: Number.NaN }),
    replacement({ startedMs: 129, completedMs: Number.POSITIVE_INFINITY }),
    replacement({ startedMs: 99 }),
  ])
    expect(
      classifySubnavRequests([aborted(), intervening, replacement({ startedMs: 180, completedMs: 240 })]).errors,
    ).toContainEqual(aborted());
  expect(
    classifySubnavRequests([
      aborted(),
      replacement({ startedMs: 180, completedMs: 240 }),
      replacement({ startedMs: 140, completedMs: 220 }),
    ]).errors,
  ).toContainEqual(aborted());
});
