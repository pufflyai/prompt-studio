import { afterEach, expect, test } from "bun:test";
import { workspaceDiffFileQueryOptions, workspaceDiffFilesQueryOptions } from "./workspace-queries";

const config = Object.getOwnPropertyDescriptor(globalThis, "__PSTDIO_CONFIG__");
const servers: ReturnType<typeof Bun.serve>[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true);
  if (config) Object.defineProperty(globalThis, "__PSTDIO_CONFIG__", config);
  else Reflect.deleteProperty(globalThis, "__PSTDIO_CONFIG__");
});

test("deferred diff queries keep the runtime that created their options", async () => {
  const requests: string[] = [];
  for (const owner of ["first", "second"]) {
    const server = Bun.serve({
      port: 0,
      fetch: (request) => {
        requests.push(owner);
        return Response.json(new URL(request.url).pathname.endsWith("/diff-files") ? { files: [] } : { filePath: "a" });
      },
    });
    servers.push(server);
  }
  Object.defineProperty(globalThis, "__PSTDIO_CONFIG__", {
    configurable: true,
    value: { apiBaseUrl: servers[0]!.url.origin },
  });
  const files = workspaceDiffFilesQueryOptions("shared-id", "current");
  const file = workspaceDiffFileQueryOptions("shared-id", "current", "a");
  Object.defineProperty(globalThis, "__PSTDIO_CONFIG__", {
    configurable: true,
    value: { apiBaseUrl: servers[1]!.url.origin },
  });
  // React Query may defer or retry either query after the selected runtime changes.
  await (files.queryFn as () => Promise<unknown>)();
  await (file.queryFn as () => Promise<unknown>)();
  expect(requests).toEqual(["first", "first"]);
});
