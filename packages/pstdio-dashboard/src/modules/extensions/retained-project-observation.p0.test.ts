import { expect, test } from "bun:test";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createExtensionsModule } from "./module";
import { emptyAppearance, flushMicrotasks } from "./module-test-fixtures";

test("an inactive retained project releases catalog observation and catches dirty data once on return", async () => {
  const queries = createScopedQueryClient({ runtimeId: "retained-catalog", extensionId: "pstdio" });
  const workbench = createWorkbench({ queries });
  workbench.activation.setActive(false);
  selectDashboardProject(workbench, { id: "retained-catalog", name: "Retained" });
  const reads = { metadata: 0, appearance: 0 };
  const registration = workbench.registerModule(
    createExtensionsModule({
      queries,
      loadMetadata: async () => {
        reads.metadata++;
        return emptyDashboardExtensionMetadata;
      },
      loadAppearance: async () => {
        reads.appearance++;
        return emptyAppearance;
      },
    }),
  );
  try {
    await flushMicrotasks();
    expect(reads).toEqual({ metadata: 0, appearance: 0 });
    workbench.activation.setActive(true);
    await flushMicrotasks();
    expect(reads).toEqual({ metadata: 1, appearance: 1 });
    workbench.activation.setActive(false);
    expect(queries.inspect().active).toBe(0);
    workbench.activation.setActive(true);
    await flushMicrotasks();
    expect(reads).toEqual({ metadata: 1, appearance: 1 });
    workbench.activation.setActive(false);
    queries.invalidate({ type: "reset" });
    await flushMicrotasks();
    expect(reads).toEqual({ metadata: 1, appearance: 1 });
    workbench.activation.setActive(true);
    await flushMicrotasks();
    expect(reads).toEqual({ metadata: 2, appearance: 2 });
  } finally {
    registration.dispose();
    await workbench.dispose();
    queries.dispose();
  }
});
