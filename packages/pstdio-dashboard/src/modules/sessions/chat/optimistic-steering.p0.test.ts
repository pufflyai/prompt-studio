import { expect, test } from "bun:test";
import { projectSteeringSubmission } from "./optimistic-steering";

test("a live submission moves immediately and yields to its confirmed message without merging older identical input", () => {
  const item = { id: "queued", prompt: "repeat", position: 1, revision: "saved" };
  const initial = { id: "initial", role: "user" as const, parts: [{ type: "text" as const, text: "repeat" }] };
  const submission = { item, previousUserMessageIds: [initial.id] };
  expect(projectSteeringSubmission([initial], [item], submission)).toEqual({
    messages: [initial, { id: item.id, role: "user", parts: [{ type: "text", text: item.prompt }] }],
    queuedFollowUps: [],
  });
  const confirmed = { ...initial, id: "native-delivery" };
  expect(projectSteeringSubmission([initial, confirmed], [item], submission)).toEqual({
    messages: [initial, confirmed],
    queuedFollowUps: [],
  });
  expect(projectSteeringSubmission([initial], [], { ...submission, deliveryId: "own-delivery" })).toEqual({
    messages: [initial, { id: "own-delivery", role: "user", parts: [{ type: "text", text: item.prompt }] }],
    queuedFollowUps: [],
  });
  expect(
    projectSteeringSubmission([initial, confirmed], [], { ...submission, deliveryId: "own-delivery" }).messages.map(
      (m) => m.id,
    ),
  ).toEqual(["initial", "native-delivery", "own-delivery"]);
  expect(projectSteeringSubmission([initial], [item], null)).toEqual({ messages: [initial], queuedFollowUps: [item] });
});
