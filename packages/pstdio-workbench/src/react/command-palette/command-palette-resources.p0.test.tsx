import { expect, jest, test } from "bun:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench } from "../../core";
import { useWorkbenchCommandPaletteResourceEntries } from "./command-palette-resources";

test("resource search completes while parent renders replace the close callback", async () => {
  const workbench = createWorkbench();
  const title = "Isolation first";
  const queries: string[] = [];
  const closed: number[] = [];
  workbench.commandPaletteResources.registerProvider({
    id: "notes",
    title: "Notes",
    query: async ({ query }) => {
      queries.push(query);
      return query === title ? [{ id: "first", label: title, activate: () => {} }] : [];
    },
  });
  const Search = ({ onClose }: { onClose: () => void }) => {
    const entries = useWorkbenchCommandPaletteResourceEntries({ workbench, query: title, open: true, onClose });
    return entries.map(({ id, label, onActivate }) => (
      <button key={id} type="button" onClick={onActivate}>
        {label}
      </button>
    ));
  };
  const render = (revision: number) => <Search onClose={() => closed.push(revision)} />;
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  let tree: ReactTestRenderer | undefined;
  jest.useFakeTimers();
  try {
    await act(async () => {
      tree = create(render(0));
    });
    for (const revision of [1, 2, 3, 4]) {
      await act(async () => {
        jest.advanceTimersByTime(50);
        tree!.update(render(revision));
      });
    }
    expect(queries).toEqual([title]);
    const result = tree!.root.findByType("button");
    expect(result.props.children).toBe(title);
    await act(async () => {
      jest.advanceTimersByTime(150);
      result.props.onClick();
    });
    expect(queries).toEqual([title]);
    expect(closed).toEqual([4]);
  } finally {
    try {
      await act(async () => tree?.unmount());
    } finally {
      jest.useRealTimers();
      environment.IS_REACT_ACT_ENVIRONMENT = previous;
      await workbench.dispose();
    }
  }
});
