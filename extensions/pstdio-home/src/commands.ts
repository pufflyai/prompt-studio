import { defineCommand, l10n } from "@pstdio/sdk/extensions";
import { buildHome } from "./build-home";
import { readHome } from "./data";

export const commands = {
  "build-home": buildHome,
  // The Sessions extension can read earlier samples until their existing retention period expires.
  quotaHistory: defineCommand({
    id: "quota-history",
    title: l10n("commands.quotaHistory", "Read saved Home quota history"),
    async run(ctx) {
      const cutoff = Date.now() - 8 * 24 * 60 * 60 * 1000;
      return (await ctx.storage.records.list()).flatMap(({ value }) =>
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        value.kind === "quota-sample" &&
        typeof value.at === "string" &&
        Date.parse(value.at) >= cutoff
          ? [value]
          : [],
      );
    },
  }),
  read: defineCommand({
    id: "read",
    title: l10n("commands.read", "Read project home"),
    cli: true,
    run: readHome,
  }),
};
