import { expect, test } from "bun:test";
import type { ExtensionUpgradeReview } from "pstdio-api-contracts";
import { findUpgradeAgentProposal, importUpgradeAgentProposal } from "./import-upgrade-agent-proposal";

const review = {
  id: "0abaa3c9-c145-472d-8e02-88d7bd3e231b",
  revision: "rev-1",
  resolutions: [{ path: "package.json", kind: "incoming" }],
} as ExtensionUpgradeReview;
const result = { reviewId: review.id, revision: review.revision };
const choice = { path: "extension.ts", kind: "text" as const, text: "export default {};" };

test("loads the newest structured assistant reply for the requested review", () => {
  const previous = JSON.stringify({ ...result, revision: "rev-0", resolutions: [] });
  const current = JSON.stringify({ ...result, resolutions: [choice] });
  const userInput = JSON.stringify({ ...result, resolutions: [] });
  const message = (role: "assistant" | "user", text: string) => ({
    id: crypto.randomUUID(),
    role,
    parts: [{ type: "text" as const, text }],
  });
  expect(
    findUpgradeAgentProposal(
      [
        message("assistant", previous),
        message("assistant", current),
        message("assistant", "See my earlier reply."),
        message("user", userInput),
      ],
      review.id,
    ),
  ).toBe(current);
});

test("imports a staged proposal alongside previously recorded choices", () => {
  const reply = `Fixed the conflict.\n\n\`\`\`json\n${JSON.stringify({ ...result, resolutions: [choice] })}\n\`\`\``;
  expect(importUpgradeAgentProposal(reply, review)).toEqual([...review.resolutions, choice]);
});

test("rejects stale proposals and leaves user choices intact", () => {
  expect(() =>
    importUpgradeAgentProposal(JSON.stringify({ ...result, revision: "rev-0", resolutions: [choice] }), review),
  ).toThrow("different revision");
  expect(() =>
    importUpgradeAgentProposal(
      JSON.stringify({ ...result, resolutions: [{ ...choice, path: "package.json" }] }),
      review,
    ),
  ).toThrow("already recorded");
});
