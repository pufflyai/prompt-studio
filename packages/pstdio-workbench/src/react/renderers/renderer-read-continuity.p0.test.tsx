import { afterEach, beforeEach, expect, test } from "bun:test";
import type { CollectionPage } from "@pstdio/sdk/extensions";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench } from "../../core";
import { useRendererPages } from "./use-renderer-pages";
import { useRendererRead } from "./use-renderer-read";

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousEnvironment = environment.IS_REACT_ACT_ENVIRONMENT;
let renderer: ReactTestRenderer | undefined;
let workbench: ReturnType<typeof createWorkbench>;
beforeEach(() => {
  workbench = createWorkbench();
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  await workbench.dispose();
  environment.IS_REACT_ACT_ENVIRONMENT = previousEnvironment;
});

test("automatic shared reads keep their original scope when the first presenter changes queries", async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const values: Record<string, ReturnType<typeof useRendererRead<string>>> = {};
  const calls: string[] = [];
  const Capture = ({ name, query }: { name: string; query: string }) => {
    values[name] = useRendererRead({
      workbench,
      ownerKey: name,
      queryKey: query,
      sourceId: "shared",
      load: () => {
        calls.push(query);
        return query;
      },
    });
    return null;
  };
  const content = (first: string) => (
    <>
      <Capture name="first" query={first} />
      <Capture name="peer" query="a" />
    </>
  );
  await act(async () => {
    renderer = create(content("a"));
  });
  await act(async () => renderer!.update(content("b")));
  await act(async () => workbench.views.reads.invalidate("shared"));
  expect(values.first.value).toBe("b");
  expect(values.peer.value).toBe("a");
  expect(calls.filter((query) => query === "a")).toHaveLength(2);
  expect(calls.filter((query) => query === "b")).toHaveLength(2);
});

test("a presenter moved to another core cannot supply that core's loader to its surviving peer", async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const other = createWorkbench();
  const values: Record<string, ReturnType<typeof useRendererRead<string>>> = {};
  const Capture = ({ name, core }: { name: string; core: typeof workbench }) => {
    values[name] = useRendererRead<string>({
      workbench: core,
      ownerKey: name,
      queryKey: "same",
      sourceId: "shared",
      load: () => (core === workbench ? "a" : "b"),
    });
    return null;
  };
  const content = (movable: typeof workbench) => (
    <>
      <Capture name="peer" core={workbench} />
      <Capture name="movable" core={movable} />
    </>
  );
  try {
    await act(async () => {
      renderer = create(content(workbench));
    });
    await act(async () => renderer!.update(content(other)));
    await act(async () => workbench.views.reads.invalidate("shared"));
    expect(values.peer.value).toBe("a");
    expect(values.movable.value).toBe("b");
  } finally {
    await act(async () => renderer?.unmount());
    renderer = undefined;
    await other.dispose();
  }
});

test("successful equal rows clear the prior refresh error in every duplicate view", async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const values: Record<string, ReturnType<typeof useRendererRead<string>>> = {};
  let failed = false;
  const Capture = ({ name }: { name: string }) => {
    values[name] = useRendererRead({
      workbench,
      ownerKey: name,
      queryKey: "same",
      load: async () => {
        if (failed) throw new Error("transient failure");
        return "unchanged";
      },
    });
    return null;
  };
  await act(async () => {
    renderer = create(
      <>
        <Capture name="one" />
        <Capture name="two" />
      </>,
    );
  });
  failed = true;
  await act(async () => {
    await values.one.retry();
  });
  expect(values.one.error).toBe("transient failure");
  expect(values.two.error).toBe("transient failure");
  failed = false;
  await act(async () => {
    await values.one.retry();
  });
  expect(values.one.error).toBeUndefined();
  expect(values.two.error).toBeUndefined();
  expect(values.two.value).toBe("unchanged");
});

test("duplicate and warm tables adopt cursor navigation from their accepted shared rows", async () => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const pages: Record<string, ReturnType<typeof useRendererPages<{ id: string }>>> = {};
  const values: Record<string, ReturnType<typeof useRendererRead<Page>>> = {};
  type Page = {
    rows: { id: string }[];
    page?: CollectionPage;
    position: ReturnType<typeof useRendererPages>["request"];
  };
  let calls = 0;
  const Capture = ({ name }: { name: string }) => {
    const page = useRendererPages<{ id: string }>({ identity: "table", scope: "same", fields: ["name"] });
    pages[name] = page;
    values[name] = useRendererRead<Page>({
      workbench,
      ownerKey: name,
      queryKey: "table",
      sourceId: "table",
      refreshKey: page.refreshKey,
      onAccept: page.accept,
      load: (signal) =>
        page.load(async (request) => {
          calls++;
          return {
            rows: [{ id: `row-${request.offset}` }],
            page: { revision: "r1", cursor: `next-${request.offset}`, total: 100, filteredTotal: 100, groups: [] },
          };
        }, signal),
    });
    return null;
  };
  await act(async () => {
    renderer = create(
      <>
        <Capture name="one" />
        <Capture name="two" />
      </>,
    );
  });
  expect(calls).toBe(1);
  await act(async () => {
    for (const name of ["one", "two"])
      pages[name].controls(values[name].value?.page, false, true, values[name].value?.position)?.onPageChange(1);
  });
  expect([pages.one.pageIndex, pages.two.pageIndex]).toEqual([1, 1]);
  expect(calls).toBe(2);
  await act(async () => renderer?.unmount());
  await act(async () => {
    renderer = create(<Capture name="one" />);
  });
  expect(calls).toBe(2);
  await act(async () => {
    pages.one.controls(values.one.value?.page, false, true, values.one.value?.position)?.onPageChange(1);
  });
  expect(pages.one.pageIndex).toBe(1);
  expect(calls).toBe(2);
});

test.each([
  false,
  true,
])("an acknowledged save reads once after acknowledgement (closed presentation: %s)", async (closed) => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const saved = Promise.withResolvers<void>();
  let current: ReturnType<typeof useRendererRead<string>> | undefined;
  let server = "before";
  let calls = 0;
  const Capture = () => {
    current = useRendererRead({
      workbench,
      ownerKey: "notes",
      queryKey: "notes",
      sourceId: "notes",
      load: async () => {
        calls++;
        return server;
      },
    });
    return null;
  };
  await act(async () => {
    renderer = create(<Capture />);
  });
  expect(current?.value).toBe("before");
  let saving: Promise<void> | undefined;
  await act(async () => {
    saving = current?.mutate(
      () => "preview",
      () => saved.promise,
    );
  });
  expect(current?.value).toBe("preview");
  await act(async () => {
    workbench.views.reads.invalidate("notes");
  });
  expect(calls).toBe(1);
  if (closed) await act(async () => renderer?.unmount());
  server = "accepted";
  await act(async () => {
    saved.resolve();
    await saving;
  });
  if (closed) {
    expect(calls).toBe(1);
    await act(async () => {
      renderer = create(<Capture />);
    });
  }
  expect(calls).toBe(2);
  expect(current?.value).toBe("accepted");
});
