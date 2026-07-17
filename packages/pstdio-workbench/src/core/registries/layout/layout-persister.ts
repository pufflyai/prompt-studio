import type { LayoutPersistenceAdapter, LayoutScope } from "./layout-model";
import { layoutScopeKey } from "./layout-scope";
import type { WorkbenchLayout } from "./layout-types";

interface PendingLayoutWrite {
  layout: WorkbenchLayout;
  scopes: Array<LayoutScope | undefined>;
}

export const createLayoutPersister = (persistence: LayoutPersistenceAdapter | undefined, delay = 100) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: PendingLayoutWrite | undefined;

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (!pending) return;

    const write = pending;
    pending = undefined;
    const scopes = write.scopes.filter(
      (scope, index) =>
        write.scopes.findIndex((candidate) => layoutScopeKey(candidate) === layoutScopeKey(scope)) === index,
    );
    for (const scope of scopes) persistence?.setLayout(write.layout, scope);
  };

  const schedule = (layout: WorkbenchLayout, scopes: Array<LayoutScope | undefined>) => {
    if (!persistence) return;
    pending = { layout, scopes };
    if (!timer) timer = setTimeout(flush, delay);
  };

  return { schedule, flush };
};
