import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { WorkbenchRegion } from "../layout/layout-types";
import type { ResourceRef } from "../resources/resource-registry";

// A page is a named composition of the bench: slots place panels into regions with a
// per-slot open policy, and bindings say which panel presents which resource kind in
// which slot. The page owns every region its slots declare; every other region keeps
// the mode's composition. The navigable location everywhere is `(page, resource?)`.

export interface WorkbenchPageSlot {
  id: string;
  region: WorkbenchRegion;
  // Static content: the registered panel to open. A slot is static or bound, never both.
  panelId?: string;
  cardinality: "one" | "many";
  closable: boolean;
  defaultOpen: boolean;
  // Static slots: how long the panel's state lives. "location" keys the widget to the
  // page's active bound instance, so a location switch remounts against that key.
  scope: "page" | "location";
  follows?: string;
  order: number;
}

export interface WorkbenchPageBinding {
  // The resource kind (`ResourceRef.type`) this binding presents.
  kind: string;
  panelId: string;
  slot: string;
}

export interface WorkbenchPageActivationInput {
  resource?: ResourceRef;
  slot?: string;
  open?: "preview" | "pin";
}

export interface WorkbenchPageContribution {
  id: string;
  title: string;
  icon?: string;
  extensionId?: string;
  // URL path under /projects/{project}/: host pages own reserved un-prefixed segments,
  // extension pages are namespaced as `{extension-id}/{path}`. Undefined pages have no
  // deep link; they still navigate in-app.
  urlPath?: string;
  slots: WorkbenchPageSlot[];
  bindings: WorkbenchPageBinding[];
  // The kinds this page presents; host pages declare them, extension pages derive them
  // from bindings.
  binds: string[];
  // Host pages activate through their own machinery (native views and presenters)
  // instead of slot composition.
  activate?: (input: WorkbenchPageActivationInput) => Promise<unknown> | unknown;
  // Host pages place emissions through their own presenters instead of bindings.
  emit?: (resource: ResourceRef, input: { open?: "preview" | "pin" }) => Promise<unknown> | unknown;
  // Host pages serialize/parse the resource segment of their URL themselves.
  resourceUrlSegment?: (resource: ResourceRef) => string | undefined;
  parseResourceSegments?: (segments: string[]) => ResourceRef | undefined;
}

export type RegisterWorkbenchPageInput = Omit<WorkbenchPageContribution, "slots" | "bindings" | "binds"> & {
  slots?: Array<
    Pick<WorkbenchPageSlot, "id" | "region"> & Partial<Omit<WorkbenchPageSlot, "id" | "region">> & { panelId?: string }
  >;
  bindings?: WorkbenchPageBinding[];
  binds?: string[];
};

export interface WorkbenchPageRegistryStoreState {
  pages: Record<string, WorkbenchPageContribution>;
}

export interface WorkbenchPageRegistry {
  store: WorkbenchStore<WorkbenchPageRegistryStoreState>;
  registerPage(page: RegisterWorkbenchPageInput): Disposable;
  getPage(id: string): WorkbenchPageContribution | undefined;
  listPages(): WorkbenchPageContribution[];
  // Resolves `/projects/{project}/...` path segments to a page and the remaining
  // resource segments. Longest urlPath wins so extension namespaces cannot shadow
  // reserved host segments (registration order breaks ties).
  resolveUrl(segments: string[]): { page: WorkbenchPageContribution; resourceSegments: string[] } | undefined;
}

const normalizeSlot = (slot: NonNullable<RegisterWorkbenchPageInput["slots"]>[number]): WorkbenchPageSlot => ({
  id: slot.id,
  region: slot.region,
  panelId: slot.panelId,
  cardinality: slot.cardinality ?? "one",
  closable: slot.closable ?? true,
  defaultOpen: slot.defaultOpen ?? true,
  scope: slot.scope ?? "page",
  follows: slot.follows,
  order: slot.order ?? 0,
});

export const createWorkbenchPageRegistry = (): WorkbenchPageRegistry => {
  const store = createWorkbenchStore<WorkbenchPageRegistryStoreState>({
    name: "workbench.pages",
    initialState: { pages: {} },
  });

  return {
    store,

    registerPage(input) {
      const snapshot = store.getState();
      if (snapshot.pages[input.id]) throw new Error(`Workbench page already registered: ${input.id}`);

      const bindings = input.bindings ?? [];
      const page: WorkbenchPageContribution = {
        ...input,
        slots: (input.slots ?? []).map(normalizeSlot),
        bindings,
        binds: input.binds ?? [...new Set(bindings.map((binding) => binding.kind))],
      };
      store.setState({ pages: { ...snapshot.pages, [page.id]: page } }, false, "registerPage");

      return createDisposable(() => {
        const current = store.getState();
        if (current.pages[page.id] !== page) return;
        const { [page.id]: _removed, ...rest } = current.pages;
        store.setState({ pages: rest }, false, "unregisterPage");
      });
    },

    getPage(id) {
      return store.getState().pages[id];
    },

    listPages() {
      return Object.values(store.getState().pages);
    },

    resolveUrl(segments) {
      const path = segments.join("/");
      const matches = Object.values(store.getState().pages).flatMap((page) => {
        if (page.urlPath === undefined) return [];
        if (page.urlPath === "") return segments.length === 0 ? [{ page, resourceSegments: [] as string[] }] : [];
        if (path !== page.urlPath && !path.startsWith(`${page.urlPath}/`)) return [];
        const resourceSegments = path === page.urlPath ? [] : path.slice(page.urlPath.length + 1).split("/");
        return [{ page, resourceSegments }];
      });
      // The longest urlPath wins so extension namespaces cannot shadow host segments.
      return matches.sort((left, right) => (right.page.urlPath?.length ?? 0) - (left.page.urlPath?.length ?? 0))[0];
    },
  };
};
