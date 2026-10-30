import { writeFileSync } from "node:fs";
import { join } from "node:path";

export const writeWorkbenchPackageConsumer = (directory: string, react: boolean) => {
  writeFileSync(
    join(directory, "workbench-consumer.ts"),
    `
import { createWorkbench } from "@pstdio/workbench";
import { createLocalStorageWorkbenchPersistence } from "@pstdio/workbench/storage";
const values = new Map<string, string>();
const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
const firstState = createLocalStorageWorkbenchPersistence({ namespace: "window", scope: "first", storage });
const secondState = createLocalStorageWorkbenchPersistence({ namespace: "window", scope: "second", storage });
const first = createWorkbench(firstState);
const second = createWorkbench({ ...secondState, active: false });
firstState.statusBarPersistence.setOrder(["first", "second"]);
secondState.statusBarPersistence.setOrder(["second", "first"]);
if (first.host.storageScope !== "first" || second.host.storageScope !== "second") throw new Error("Workbench lost storage ownership");
if (firstState.statusBarPersistence.getOrder()?.[0] !== "first") throw new Error("Another workbench overwrote the status order");
first.activation.setActive(false);
second.activation.setActive(true);
if (first.activation.isActive() || !second.activation.isActive()) throw new Error("Workbench activation did not switch");
${
  react
    ? `import { Portal, ScopedDialog, ScopedMenu, ScopedPopover, useScopedMenu, useToaster } from "@pstdio/ui";
void [Portal, ScopedDialog, ScopedMenu, ScopedPopover, useScopedMenu, useToaster];`
    : ""
}
await first.dispose();
await second.dispose();
`,
  );
};
