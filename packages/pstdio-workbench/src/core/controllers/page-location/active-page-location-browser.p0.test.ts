import { expect, test } from "bun:test";
import { createWorkbenchActivation } from "../../workbench-activation";
import { createActivePageLocationBrowser } from "./active-page-location-browser";
import { createMemoryWorkbenchPageLocationBrowser } from "./page-location-memory";
import type { WorkbenchPageBrowserEntry } from "./page-location-types";

test("shared history replays stamped entries across reloads", () => {
  const memory = createMemoryWorkbenchPageLocationBrowser();
  const original = createActivePageLocationBrowser(memory, createWorkbenchActivation());
  const hidden = createActivePageLocationBrowser(memory, createWorkbenchActivation(false));
  original.browser.push({ url: "/a/start", state: { page: "start" } });
  original.browser.push({ url: "/a/editor", state: { page: "editor" } });
  original.dispose();
  hidden.dispose();

  const reloaded = createActivePageLocationBrowser(memory, createWorkbenchActivation());
  const inactive = createActivePageLocationBrowser(memory, createWorkbenchActivation(false));
  const received: WorkbenchPageBrowserEntry[] = [];
  reloaded.browser.onPopState((entry) => received.push(entry));
  try {
    memory.back();
    expect(reloaded.browser.current()).toEqual({ url: "/a/start", state: { page: "start" } });
    memory.forward();
    expect(reloaded.browser.current()).toEqual({ url: "/a/editor", state: { page: "editor" } });
    expect(received).toEqual([
      { url: "/a/start", state: { page: "start" } },
      { url: "/a/editor", state: { page: "editor" } },
    ]);
    expect(inactive.browser.current()).toEqual({ url: "/a/editor", state: { page: "editor" } });
  } finally {
    reloaded.dispose();
    inactive.dispose();
  }
});

test.each(["unchanged", "unknown"])("shared history ignores %s native positions", (position) => {
  const memory = createMemoryWorkbenchPageLocationBrowser();
  let emit: ((entry: WorkbenchPageBrowserEntry) => void) | undefined;
  const browser = {
    ...memory,
    onPopState(listener: (entry: WorkbenchPageBrowserEntry) => void) {
      emit = listener;
      return memory.onPopState(listener);
    },
  };
  const a = createActivePageLocationBrowser(browser, createWorkbenchActivation());
  const b = createActivePageLocationBrowser(browser, createWorkbenchActivation(false));
  try {
    a.browser.push({ url: "/a/start" });
    a.browser.push({ url: "/a/editor" });
    const native = position === "unchanged" ? memory.current() : { url: "/outside", state: null };
    memory.replace(native);
    emit!(native);
    expect(a.browser.current().url).toBe("/a/editor");
    expect(memory.current()).toEqual(native);
  } finally {
    a.dispose();
    b.dispose();
  }
});

test("shared history traverses new entries after returning to pre-reload history", () => {
  const memory = createMemoryWorkbenchPageLocationBrowser();
  const original = createActivePageLocationBrowser(memory, createWorkbenchActivation());
  const hidden = createActivePageLocationBrowser(memory, createWorkbenchActivation(false));
  original.browser.push({ url: "/a/start" });
  original.browser.push({ url: "/a/editor" });
  original.dispose();
  hidden.dispose();

  const reloaded = createActivePageLocationBrowser(memory, createWorkbenchActivation());
  const inactive = createActivePageLocationBrowser(memory, createWorkbenchActivation(false));
  try {
    reloaded.browser.push({ url: "/a/new" });
    memory.back();
    expect(reloaded.browser.current().url).toBe("/a/editor");
    memory.back();
    expect(reloaded.browser.current().url).toBe("/a/start");
    memory.forward();
    expect(reloaded.browser.current().url).toBe("/a/editor");
    memory.forward();
    expect(reloaded.browser.current().url).toBe("/a/new");

    memory.back();
    memory.back();
    reloaded.browser.replace({ url: "/a/replaced" });
    reloaded.browser.push({ url: "/a/next" });
    memory.back();
    expect(reloaded.browser.current().url).toBe("/a/replaced");
    memory.forward();
    expect(reloaded.browser.current().url).toBe("/a/next");
  } finally {
    reloaded.dispose();
    inactive.dispose();
  }
});

test("retired history owners clear their ledger and fence retained browser wrappers", () => {
  const memory = createMemoryWorkbenchPageLocationBrowser();
  const activation = createWorkbenchActivation();
  const a = createActivePageLocationBrowser(memory, activation);
  const b = createActivePageLocationBrowser(memory, createWorkbenchActivation(false));
  a.browser.push({ url: "/a/private" });
  let calls = 0;
  a.browser.onPopState(() => {
    calls++;
  });
  a.dispose();
  const native = memory.current();
  a.browser.push({ url: "/a/late" });
  a.browser.replace({ url: "/a/replaced" });
  a.browser.back();
  a.browser.forward();
  activation.setActive(false);
  activation.setActive(true);
  a.browser.onPopState(() => {
    calls++;
  });
  expect(memory.current()).toBe(native);
  expect(a.browser.current()).toEqual({ url: "/" });
  expect(calls).toBe(0);
  expect(a.inspect()).toMatchObject({ entries: 0, listeners: 0, owners: 1 });
  a.dispose();
  b.dispose();
});

test("history cleanup releases its window binding even if native unsubscription throws", () => {
  const memory = createMemoryWorkbenchPageLocationBrowser();
  let connections = 0;
  const browser = {
    ...memory,
    onPopState(listener: (entry: WorkbenchPageBrowserEntry) => void) {
      connections++;
      const subscription = memory.onPopState(listener);
      return {
        dispose() {
          subscription.dispose();
          throw new Error("native stop failed");
        },
      };
    },
  };
  const a = createActivePageLocationBrowser(browser, createWorkbenchActivation());
  a.browser.push({ url: "/a/private" });
  expect(() => a.dispose()).toThrow("native stop failed");
  expect(a.browser.current()).toEqual({ url: "/" });
  expect(() => a.dispose()).not.toThrow();
  const reloaded = createActivePageLocationBrowser(browser, createWorkbenchActivation());
  expect(connections).toBe(2);
  expect(() => reloaded.dispose()).toThrow("native stop failed");
});

test("long alternating project histories retain ordered traversal with bounded native metadata", () => {
  const memory = createMemoryWorkbenchPageLocationBrowser();
  const activationA = createWorkbenchActivation();
  const activationB = createWorkbenchActivation(false);
  const a = createActivePageLocationBrowser(memory, activationA);
  const b = createActivePageLocationBrowser(memory, activationB);
  const select = (project: "a" | "b") => {
    activationA.setActive(project === "a");
    activationB.setActive(project === "b");
  };
  try {
    for (let i = 1; i <= 300; i++) {
      select("a");
      a.browser.push({ url: `/a/${i}` });
      select("b");
      b.browser.push({ url: `/b/${i}` });
    }
    expect(a.inspect().metadata).toBeLessThanOrEqual(128);
    for (const [project, wrapper] of [
      ["a", a],
      ["b", b],
    ] as const) {
      select(project);
      for (let i = 299; i >= 0; i--) {
        wrapper.browser.back();
        expect(wrapper.browser.current().url).toBe(i ? `/${project}/${i}` : "/");
      }
      for (let i = 1; i <= 300; i++) {
        wrapper.browser.forward();
        expect(wrapper.browser.current().url).toBe(`/${project}/${i}`);
      }
    }
    expect(b.inspect().metadata).toBeLessThanOrEqual(128);
  } finally {
    a.dispose();
    b.dispose();
  }
});

test("native traversal recognizes evicted metadata without replaying another project's rows", () => {
  const memory = createMemoryWorkbenchPageLocationBrowser();
  const a = createActivePageLocationBrowser(memory, createWorkbenchActivation());
  const b = createActivePageLocationBrowser(memory, createWorkbenchActivation(false));
  try {
    for (let i = 1; i <= 400; i++) a.browser.push({ url: `/a/${i}` });
    expect(a.inspect().metadata).toBe(128);
    for (let i = 399; i >= 1; i--) {
      memory.back();
      expect(a.browser.current().url).toBe(`/a/${i}`);
    }
    for (let i = 2; i <= 400; i++) {
      memory.forward();
      expect(a.browser.current().url).toBe(`/a/${i}`);
    }
    expect(a.inspect().metadata).toBeLessThanOrEqual(128);
  } finally {
    a.dispose();
    b.dispose();
  }
});

test("inactive project history remains ordered even when its entries never reached native history", () => {
  const memory = createMemoryWorkbenchPageLocationBrowser();
  const activationA = createWorkbenchActivation();
  const activationB = createWorkbenchActivation(false);
  const a = createActivePageLocationBrowser(memory, activationA);
  const b = createActivePageLocationBrowser(memory, activationB);
  a.browser.push({ url: "/a/active" });
  try {
    for (let i = 1; i <= 300; i++) b.browser.push({ url: `/b/${i}` });
    expect(memory.current().url).toBe("/a/active");
    activationA.setActive(false);
    activationB.setActive(true);
    for (let i = 299; i >= 1; i--) {
      b.browser.back();
      expect(b.browser.current().url).toBe(`/b/${i}`);
    }
    for (let i = 2; i <= 300; i++) {
      b.browser.forward();
      expect(b.browser.current().url).toBe(`/b/${i}`);
    }
  } finally {
    a.dispose();
    b.dispose();
  }
});

test("reentrant native cleanup can install a new history owner without reviving the retired owner", () => {
  const memory = createMemoryWorkbenchPageLocationBrowser();
  let reloaded: ReturnType<typeof createActivePageLocationBrowser> | undefined;
  let connections = 0;
  const browser = {
    ...memory,
    onPopState(listener: (entry: WorkbenchPageBrowserEntry) => void) {
      const own = ++connections;
      const subscription = memory.onPopState(listener);
      return {
        dispose() {
          subscription.dispose();
          if (own === 1) reloaded = createActivePageLocationBrowser(browser, createWorkbenchActivation());
        },
      };
    },
  };
  const a = createActivePageLocationBrowser(browser, createWorkbenchActivation());
  a.dispose();
  expect(connections).toBe(2);
  expect(a.inspect()).toMatchObject({ owners: 0, entries: 0, metadata: 0 });
  reloaded!.browser.push({ url: "/new" });
  expect(memory.current().url).toBe("/new");
  reloaded!.dispose();
});

test("a second owner never replays the first owner's evicted pre-sharing native entries", () => {
  const memory = createMemoryWorkbenchPageLocationBrowser();
  const activationA = createWorkbenchActivation();
  const a = createActivePageLocationBrowser(memory, activationA);
  for (let i = 1; i <= 400; i++)
    a.browser.push({ url: `/projects/a/${i}`, state: { kind: "pstdio.page-location", projectId: "a", index: i } });
  const activationB = createWorkbenchActivation(false);
  const b = createActivePageLocationBrowser(memory, activationB);
  b.browser.replace({ url: "/projects/b/0" });
  b.browser.push({ url: "/projects/b/1" });
  b.browser.push({ url: "/projects/b/2" });
  activationA.setActive(false);
  activationB.setActive(true);
  try {
    for (let i = 0; i < 300; i++) memory.back();
    expect(b.browser.current().url).toBe("/projects/b/0");
    expect(a.browser.current().url).toBe("/projects/a/400");
  } finally {
    a.dispose();
    b.dispose();
  }
});
