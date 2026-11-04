import { defineCommand, l10n } from "@pstdio/sdk/extensions";
import { readHome } from "./data";

export const commands = {
  read: defineCommand({
    id: "read",
    title: l10n("commands.read", "Read project home"),
    cli: true,
    run: readHome,
  }),
};
