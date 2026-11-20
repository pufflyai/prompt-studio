import { expect, test } from "bun:test";
import { gzipSync } from "node:zlib";
import { createFrameAssetLoader } from "./asset-loader";
import type { FrameAssetRequest } from "./module-graph";

const encoded = (code: string) => gzipSync(code).toString("base64");
test("concurrent frames reuse immutable runtime assets without sharing frame state", async () => {
  const requests: FrameAssetRequest[] = [];
  const load = createFrameAssetLoader(async (request) => {
    requests.push(request);
    const modules = request.source === "$runtime" ? ["runtime.js"] : ["runtime.js", "example.js"];
    return {
      entry: "runtime.js",
      modules,
      styles: ["theme.css"],
      files: Object.fromEntries(
        [...modules, "theme.css"].filter((name) => !request.cached.includes(name)).map((name) => [name, encoded(name)]),
      ),
    };
  });
  const [first, second] = await Promise.all([load("button"), load("button")]);
  expect(requests).toHaveLength(2);
  expect(requests[1].cached).toEqual(["runtime.js", "theme.css"]);
  expect(first).toBe(second);
  expect(await first.scripts["example.js"].text()).toBe("example.js");
  expect(first.styles[0].type.split(";")[0]).toBe("text/css");
  expect(first.scripts["example.js"].type.split(";")[0]).toBe("text/javascript");
});

test("a failed asset load can be retried instead of poisoning the viewer cache", async () => {
  let failed = false;
  const load = createFrameAssetLoader(async () => {
    if (!failed) {
      failed = true;
      throw new Error("Interrupted download");
    }
    return { entry: "runtime.js", modules: ["runtime.js"], styles: [], files: { "runtime.js": encoded("runtime") } };
  });
  await expect(load("button")).rejects.toThrow("Interrupted download");
  expect(await (await load("button")).scripts["runtime.js"].text()).toBe("runtime");
});

test("new builds release obsolete cached module bytes and preview revisions", async () => {
  const requests: FrameAssetRequest[] = [];
  let revision = 1;
  const load = createFrameAssetLoader(async (request) => {
    requests.push(request);
    const modules = request.source === "$runtime" ? ["runtime.js"] : ["runtime.js", `example-${revision}.js`];
    return {
      entry: "runtime.js",
      modules,
      styles: [],
      files: Object.fromEntries(
        modules.filter((name) => !request.cached.includes(name)).map((name) => [name, encoded(name)]),
      ),
    };
  });
  const first = await load("button", "1");
  revision = 2;
  await load("button", "2");
  await load("other", "2");
  expect(requests.at(-1)!.cached).not.toContain("example-1.js");
  // A mounted old frame still owns its bytes even though the loader released them.
  expect(await first.scripts["example-1.js"].text()).toBe("example-1.js");
  const count = requests.length;
  await load("button", "1");
  expect(requests.length).toBeGreaterThan(count);
});

test("switching designs reuses common bytes and releases older designs", async () => {
  const requests: FrameAssetRequest[] = [];
  const load = createFrameAssetLoader(async (request) => {
    requests.push(request);
    const modules = request.source === "$runtime" ? ["runtime.js"] : ["runtime.js", "ui.js", request.source];
    return {
      entry: "runtime.js",
      modules,
      styles: [],
      files: Object.fromEntries(
        modules.filter((name) => !request.cached.includes(name)).map((name) => [name, encoded(name)]),
      ),
    };
  });
  const a = await load("a.js");
  await load("b.js");
  expect(requests.at(-1)?.cached).toContain("ui.js");
  expect(await load("a.js")).toBe(a);
  await load("c.js");
  await load("d.js");
  expect(requests.at(-1)?.cached).not.toContain("b.js");
  expect(requests.at(-1)?.cached).toContain("ui.js");
  expect(await load("a.js")).not.toBe(a);
});

test("a failed evicted load preserves the replacement for the same revision", async () => {
  const entered = Promise.withResolvers<void>();
  const interrupted = Promise.withResolvers<never>();
  let first = true;
  const load = createFrameAssetLoader(async ({ source, cached }) => {
    if (source === "a" && first) {
      first = false;
      entered.resolve();
      await interrupted.promise;
    }
    const name = `${source}.js`;
    return { entry: name, modules: [name], styles: [], files: cached.includes(name) ? {} : { [name]: encoded(name) } };
  });
  const pending = load("a", "1");
  await entered.promise;
  await load("b");
  await load("c");
  const replacement = await load("a", "1");
  interrupted.reject(new Error("Old load failed"));
  await expect(pending).rejects.toThrow("Old load failed");
  expect(await load("a", "1")).toBe(replacement);
});
