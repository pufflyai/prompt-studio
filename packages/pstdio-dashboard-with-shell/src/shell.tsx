import { createShellCore } from "pstdio-shell/core";
import { ShellWorkbench } from "pstdio-shell/react";
import { createModesModule } from "./modes/module";
import { createCommandPaletteModule } from "./modules/command-palette/module";
import { createProjectsModule } from "./modules/projects/module";
import { createSessionsModule } from "./modules/sessions/module";
import { createSettingsModule } from "./modules/settings/module";
import { createShortcutsModule } from "./modules/shortcuts/module";

const shell = createShellCore();
shell.registerModule(createCommandPaletteModule());
shell.registerModule(createShortcutsModule());
shell.registerModule(createSettingsModule());
shell.registerModule(createProjectsModule());
shell.registerModule(createSessionsModule());
shell.registerModule(createModesModule());

export const DashboardShell = () => {
  return <ShellWorkbench shell={shell} />;
};
