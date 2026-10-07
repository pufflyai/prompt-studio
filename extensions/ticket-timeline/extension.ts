// Register the ticket timeline page, its navigation row, and the commands it reads and writes through.
import { defineExtension } from "@pstdio/sdk/extensions";
import { actionCleanup } from "./src/commands/action-cleanup";
import { commands } from "./src/commands/index";
import { timelineNavigation, timelinePage, timelineView } from "./src/pages";

export default defineExtension({
  hooks: [actionCleanup],
  commands: Object.values(commands),
  views: [timelineView],
  pages: [timelinePage],
  navigationItems: [timelineNavigation],
});
