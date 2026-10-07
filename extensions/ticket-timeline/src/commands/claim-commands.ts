// Inspect and conditionally release a known abandoned write claim after stopping its writer.
import { defineCommand, params } from "@pstdio/sdk/extensions";
import type { WriteClaim } from "./write-guard";

export const readClaimsCommand = defineCommand({
  id: "write-claim.read",
  title: "Inspect write claims",
  cli: { description: "List active claims and their owner tokens for crash recovery." },
  async run(ctx) {
    return ctx.storage.collection<WriteClaim>("write-claims").list();
  },
});

export const releaseClaimCommand = defineCommand({
  id: "write-claim.release",
  title: "Release abandoned write claim",
  cli: { description: "After stopping the old writer, release its exact owner token. Never release a live writer." },
  mutating: true,
  params: { key: params.text({ required: true }), expectedToken: params.text({ required: true }) },
  async run(ctx, { key, expectedToken }) {
    const claims = ctx.storage.collection<WriteClaim>("write-claims");
    const claim = await claims.get(key);
    if (!claim || claim.token !== expectedToken || !(await claims.deleteIfValue(key, claim))) {
      throw new Error("The claim changed or no longer exists. Inspect claims again.");
    }
    return { released: key };
  },
});
