import { expect, test } from "bun:test";
import { classifySubnavRequests, type SubnavObservedRequest } from "./subnav-request-outcomes";

const postData = (label = "Ticket", overrides: Record<string, unknown> = {}) => ({
  projectId: "project",
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
  startedMs: 100,
  durationMs: 50,
  completedMs: 150,
  postData: postData(),
  status: 200,
  outcomeOk: true,
  ...overrides,
});
const aborted = () => request({ failure: "net::ERR_ABORTED", status: undefined, outcomeOk: undefined });
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

test("unmatched aborts, unchanged-payload retries and other transport failures remain errors", () => {
  for (const rows of [
    [aborted()],
    [aborted(), replacement({ postData: postData() })],
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
  const middle = replacement({ failure: "net::ERR_ABORTED", status: undefined, outcomeOk: undefined });
  const latest = replacement({ startedMs: 200, completedMs: 260, postData: postData("Latest ticket") });
  const result = classifySubnavRequests([aborted(), middle, latest]);
  expect(result.errors).toEqual([]);
  expect(result.requests.map(({ supersededBy }) => supersededBy)).toEqual([2, 2, undefined]);
  expect(classifySubnavRequests([aborted(), middle]).errors).toHaveLength(2);
  expect(classifySubnavRequests([aborted(), replacement({ postData: postData() }), latest]).errors).toContainEqual(
    aborted(),
  );
  for (const clock of [Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(classifySubnavRequests([aborted(), replacement({ startedMs: clock })]).errors).toContainEqual(aborted());
    expect(classifySubnavRequests([aborted(), replacement({ completedMs: clock })]).errors).toContainEqual(aborted());
    expect(classifySubnavRequests([request({ ...aborted(), startedMs: clock }), latest]).errors).toHaveLength(1);
  }
});
