import { expect, spyOn, test } from "bun:test";
import { createWorkbench, type WorkbenchPanelInstance } from "@pstdio/workbench";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { useWebviewPageProps } from "./use-webview-page-props";

test("a bound webview ignores unrelated page catalog changes and still follows its defaults", async () => {
  const environment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const workbench = createWorkbench();
  const page = { kind: "page" as const, id: "form", extensionId: "example" };
  workbench.modes.registerMode({ id: "project", activate: () => {} });
  workbench.views.registerView({ id: "form", title: "Form", body: { kind: "react", render: () => null } });
  let registration = workbench.pages.registerPage({
    id: "form",
    ref: page,
    path: "form",
    modeId: "project",
    params: { name: { type: "string", default: "New" } },
    main: { kind: "view", view: { kind: "view", id: "form" }, cardinality: "one" },
    slots: [],
  });
  const placement: WorkbenchPanelInstance = {
    instanceId: "form",
    panelId: "form",
    closable: true,
    pageContext: { page },
  };
  let renders = 0;
  let current: ReturnType<typeof useWebviewPageProps>;
  const Probe = () => {
    renders++;
    current = useWebviewPageProps(workbench, placement);
    return createElement("span", null, String(current.pageParams.name));
  };
  let renderer: ReactTestRenderer | undefined;
  const serialization = spyOn(JSON, "stringify");
  try {
    await act(async () => {
      renderer = create(createElement(Probe));
    });
    const initial = renders;
    await act(async () => {
      workbench.pages.registerPage({
        id: "other",
        ref: { ...page, id: "other" },
        path: "other",
        modeId: "project",
        main: { kind: "view", view: { kind: "view", id: "form" }, cardinality: "one" },
        slots: [],
      });
    });
    const afterUnrelated = renders;
    await act(async () => {
      registration.dispose();
      registration = workbench.pages.registerPage({
        id: "form",
        ref: page,
        path: "form",
        modeId: "project",
        params: { name: { type: "string", default: "Updated" } },
        main: { kind: "view", view: { kind: "view", id: "form" }, cardinality: "one" },
        slots: [],
      });
    });
    expect(current!.pageParams.name).toBe("Updated");
    expect(afterUnrelated).toBe(initial);
    expect(
      serialization.mock.calls.filter(([value]) => value && typeof value === "object" && "pageParams" in value),
    ).toHaveLength(0);
  } finally {
    serialization.mockRestore();
    await act(async () => renderer?.unmount());
    await workbench.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

test("a webview follows its replacement core and placement without accepting the old core's pages", async () => {
  const environment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const page = { kind: "page" as const, id: "form", extensionId: "example" };
  const createOwner = (name: string) => {
    const owner = createWorkbench();
    owner.modes.registerMode({ id: "project", activate: () => {} });
    owner.views.registerView({ id: "form", title: "Form", body: { kind: "react", render: () => null } });
    owner.pages.registerPage({
      id: "form",
      ref: page,
      path: "form",
      modeId: "project",
      params: { name: { type: "string", default: name } },
      main: { kind: "view", view: { kind: "view", id: "form" }, cardinality: "one" },
      slots: [],
    });
    return owner;
  };
  const first = createOwner("First");
  const second = createOwner("Second");
  let workbench = first;
  let placement: WorkbenchPanelInstance = {
    instanceId: "form",
    panelId: "form",
    closable: true,
    pageContext: { page },
  };
  let current: ReturnType<typeof useWebviewPageProps>;
  let renders = 0;
  const Probe = () => {
    renders++;
    current = useWebviewPageProps(workbench, placement);
    return createElement("span", null, String(current.pageParams.name));
  };
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(createElement(Probe));
    });
    expect(current!.pageParams.name).toBe("First");
    await act(async () => {
      workbench = second;
      renderer!.update(createElement(Probe));
    });
    expect(current!.pageParams.name).toBe("Second");
    const beforeOldChange = renders;
    await act(async () => {
      first.pages.registerPage({
        id: "retired",
        ref: { ...page, id: "retired" },
        path: "retired",
        modeId: "project",
        main: { kind: "view", view: { kind: "view", id: "form" }, cardinality: "one" },
        slots: [],
      });
    });
    expect(renders).toBe(beforeOldChange);
    await act(async () => {
      placement = {
        ...placement,
        resource: { type: "document", id: "replacement" },
        pageContext: { page, params: { name: "Explicit" } },
      };
      renderer!.update(createElement(Probe));
    });
    expect(current!.pageParams.name).toBe("Explicit");
    expect(current!.pageLocation?.resource?.id).toBe("replacement");
  } finally {
    await act(async () => renderer?.unmount());
    await first.dispose();
    await second.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
