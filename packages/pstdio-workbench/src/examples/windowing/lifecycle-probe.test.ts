import { expect, test } from "bun:test";
import { resourceKey } from "@pstdio/sdk/extensions";
import { createWindowingLifecycleProbe } from "./lifecycle-probe";
import { createWindowingResources } from "./resources";

test("lifecycle counters expose every start and stop invocation", () => {
  const probe = createWindowingLifecycleProbe();
  const resource = createWindowingResources().terminals[0]!;
  probe.start(resource);
  probe.start(resource);
  probe.stop(resource);
  probe.stop(resource);
  expect(probe.store.getState().sessions[resourceKey(resource)]).toEqual({ starts: 2, stops: 2, running: false });
});

test("reattaching a view preserves its running or stopped resource runtime", () => {
  const probe = createWindowingLifecycleProbe();
  const resource = createWindowingResources().terminals[0]!;
  probe.attach(resource);
  probe.attach(resource);
  expect(probe.store.getState().sessions[resourceKey(resource)]).toEqual({ starts: 1, stops: 0, running: true });
  probe.stop(resource);
  probe.attach(resource);
  expect(probe.store.getState().sessions[resourceKey(resource)]).toEqual({ starts: 1, stops: 1, running: false });
});
