import { afterAll, beforeAll, expect, test } from "bun:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { type HostStorage, HostStorageProvider } from "../../utils/host-storage";
import { createCollectionViewStore, useCollectionViewStore } from "./use-collection-view-store";

const reactTestGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousActEnvironment = reactTestGlobal.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => {
  reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => {
  reactTestGlobal.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});

const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};

const initialState = { settings: { viewMode: "board" } };

const ViewState = (props: { storageKey: string }) => {
  const { storageKey } = props;
  const state = useCollectionViewStore(storageKey, initialState, (view) => view);
  return <span>{`${state.activeViewId}: ${state.settings.viewMode}`}</span>;
};

const readView = async (host: HostStorage, storageKey: string) => {
  let view!: ReactTestRenderer;
  await act(async () => {
    view = create(
      <HostStorageProvider storage={host}>
        <ViewState storageKey={storageKey} />
      </HostStorageProvider>,
    );
  });
  const text = view.root.findByType("span").children.join("");
  await act(async () => view.unmount());
  return text;
};

const saveView = (host: HostStorage, storageKey: string, viewId: string) => {
  const store = createCollectionViewStore({ storageKey, initialState, storage: host });
  store.getState().activateView({
    id: viewId,
    title: "Saved view",
    settings: { viewMode: "list" },
    filter: { conjunction: "and", rules: [] },
    sorts: [],
  });
};

test("a collection restores the host's active view and display settings", async () => {
  const host = storage();
  saveView(host, "host-restored-view", "saved");
  expect(await readView(host, "host-restored-view")).toBe("saved: list");
});

test("hosts with the same collection key retain separate saved view state", async () => {
  const first = storage();
  const second = storage();
  saveView(first, "same-collection", "first");
  saveView(second, "same-collection", "second");
  expect(await readView(first, "same-collection")).toBe("first: list");
  expect(await readView(second, "same-collection")).toBe("second: list");
});
