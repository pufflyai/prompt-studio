import { describe, expect, test } from "bun:test";
import { commands } from ".";
import { setup } from "./test-context";

describe("social radar settings", () => {
  test("updates one site's targets and budget without replacing other settings", async () => {
    const { ctx } = setup();
    await commands["update-site"].run(ctx, { site: "reddit", targets: ["r/LocalLLaMA"], budget: 2 });
    await commands["update-settings"].run(ctx, { input: { brandTerms: ["Prompt Studio"], topics: ["agent flow"] } });
    expect(await commands["get-settings"].run(ctx, {})).toMatchObject({
      brandTerms: ["Prompt Studio"],
      topics: ["agent flow"],
      targets: { reddit: ["r/LocalLLaMA"], bluesky: [] },
      budgets: { reddit: 2, hn: 4 },
    });
  });
});
