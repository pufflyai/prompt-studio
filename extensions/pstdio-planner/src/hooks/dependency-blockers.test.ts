import { expect, test } from "bun:test";
import { fixture } from "../commands/auto-build.fixture";
import { ticketsCollection } from "../data/ticket-context.fixture";

import { dependencyBlockerHooks } from "./dependency-blockers";

for (const hook of dependencyBlockerHooks) {
  test(`${hook.event.id} clears dependency-only blocker text for completed prerequisites`, async () => {
    const { ctx, ticket, storage } = await fixture();
    const prerequisite = await ticket("Completed prerequisite");
    const child = await ticket("Dependent contract", [prerequisite.id]);
    const collection = ticketsCollection(storage);
    await collection.put(prerequisite.id, { ...prerequisite, statusId: "done" });
    await collection.put(child.id, {
      ...child,
      blockedReason: `Complete ${prerequisite.shorthand} before implementing this dependent contract.`,
    });
    await hook.run(
      { ...ctx, eventId: hook.event.id, deliveryId: "dependency-blocker-check" },
      { projectId: ctx.projectId, ticketId: prerequisite.id },
    );
    expect(await collection.get(child.id)).toMatchObject({ blockedReason: null, dependsOn: [prerequisite.id] });
  });
}
