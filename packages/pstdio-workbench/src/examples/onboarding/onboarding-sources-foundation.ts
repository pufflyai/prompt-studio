export const onboardingFoundationSources = {
  emptyWorkbench: `import { createWorkbench } from "@pstdio/workbench";
import {
  Workbench,
  WorkbenchThemeProvider,
} from "@pstdio/workbench/react";

const workbench = createWorkbench();

export const App = () => (
  <WorkbenchThemeProvider>
    <Workbench workbench={workbench} />
  </WorkbenchThemeProvider>
);`,
} as const;
