import type { WorkbenchCore } from "@pstdio/workbench";

export const registerHomePage = (workbench: WorkbenchCore) =>
  workbench.pages.registerPage({
    id: "pstdio.pstdio-home.page.home",
    ref: { kind: "page", extensionId: "pstdio.pstdio-home", id: "home" },
    path: "home",
    modeId: "project",
    main: { kind: "panels" },
    slots: [],
  });
