import { expect, test } from "bun:test";
import { acquirePreparationBuildCommand, preparationBuildConcurrency } from "./preparation-command-slots";

test("cancellation from admission notification cannot lose a granted leaf permit", async () => {
  const held = await Promise.all(
    Array.from({ length: preparationBuildConcurrency }, () =>
      acquirePreparationBuildCommand(new AbortController().signal, () => {}),
    ),
  );
  const controller = new AbortController();
  const pending = acquirePreparationBuildCommand(controller.signal, (waiting) => {
    if (!waiting) controller.abort(new Error("Retired on admission"));
  }).catch((error) => error);
  held[0]!();
  const admitted = await pending;
  try {
    expect(typeof admitted).toBe("function");
  } finally {
    if (typeof admitted === "function") admitted();
    for (const release of held) release();
  }
  const next = await Promise.all(
    Array.from({ length: preparationBuildConcurrency }, () =>
      acquirePreparationBuildCommand(new AbortController().signal, () => {}),
    ),
  );
  for (const release of next) release();
});
