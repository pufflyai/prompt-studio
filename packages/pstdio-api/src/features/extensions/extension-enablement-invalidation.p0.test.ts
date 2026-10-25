import { describe, expect, test } from "bun:test";
import { EventBus } from "../sync/event-bus";
import { subscribeExtensionEnablementInvalidation } from "./extension-enablement-invalidation";

type InvalidateCall = { projectId?: string; sourcePath?: string; reason: string };

describe("subscribeExtensionEnablementInvalidation", () => {
  test("invalidates the scoped project when an instance row names it", () => {
    const eventBus = new EventBus();
    const invalidations: InvalidateCall[] = [];

    subscribeExtensionEnablementInvalidation({
      eventBus,
      invalidate: (input) => invalidations.push(input),
    });

    eventBus.emit("extension_instances", "set", {
      id: "instance-1",
      scope_type: "project",
      scope_id: "project-1",
      enabled: false,
    });

    expect(invalidations).toEqual([{ projectId: "project-1", reason: "enablement_changed" }]);
  });

  test("invalidates only the project named by a delete event", () => {
    const eventBus = new EventBus();
    const invalidations: InvalidateCall[] = [];

    subscribeExtensionEnablementInvalidation({
      eventBus,
      invalidate: (input) => invalidations.push(input),
    });

    eventBus.emit("extension_instances", "delete", {
      id: "instance-1",
      installed_extension_id: "source-1",
      scope_type: "project",
      scope_id: "project-1",
    });

    expect(invalidations).toEqual([{ projectId: "project-1", reason: "enablement_changed" }]);
  });

  test("ignores events for unrelated tables", () => {
    const eventBus = new EventBus();
    const invalidations: InvalidateCall[] = [];

    subscribeExtensionEnablementInvalidation({
      eventBus,
      invalidate: (input) => invalidations.push(input),
    });

    eventBus.emit("installed_extension_sources", "set", { id: "source-1" });

    expect(invalidations).toHaveLength(0);
  });
});
