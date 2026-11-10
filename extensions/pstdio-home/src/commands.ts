import { defineCommand, l10n } from "@pstdio/sdk/extensions";
import { readHome } from "./data";
import { readQuotas } from "./quotas";

export const commands = {
  quotas: defineCommand({
    id: "quotas",
    title: l10n("commands.quotas", "Read agent quotas"),
    cli: true,
    run: readQuotas,
  }),
  read: defineCommand({
    id: "read",
    title: l10n("commands.read", "Read project home"),
    cli: true,
    run: readHome,
  }),
};
