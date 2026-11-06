import { expect, test } from "bun:test";
import { l10n } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandArgs } from "../../commands/command-context.fixture";
import { readPlanCommand } from "../commands/read-plan";
import { timelineQueryData } from "./query-data";

test("timeline choices localize their notes while retaining group presentation", async () => {
  const [ctx] = makeCommandArgs({ storage: createMemoryStorage(), params: {} });
  const plan = await readPlanCommand.run(ctx, {});
  plan.ticketAttributes.push({
    id: "review-stage",
    label: l10n("stage", "Stage"),
    type: {
      kind: "enum",
      options: [
        {
          value: "review",
          label: l10n("review", "Review"),
          note: l10n("review.note", "Waiting for review"),
          icon: "calendar",
          color: "blue",
          canCreate: true,
        },
      ],
    },
  });
  const translations: Record<string, string> = {
    stage: "Étape",
    review: "Révision",
    "review.note": "En attente de révision",
  };
  const data = timelineQueryData(plan, (key, fallback) => translations[key] ?? fallback ?? key);
  expect(data.attributes.find(({ id }) => id === "review-stage")).toEqual({
    id: "review-stage",
    label: "Étape",
    type: {
      kind: "enum",
      options: [
        {
          value: "review",
          label: "Révision",
          note: "En attente de révision",
          icon: "calendar",
          color: "blue",
          canCreate: true,
        },
      ],
    },
  });
});
