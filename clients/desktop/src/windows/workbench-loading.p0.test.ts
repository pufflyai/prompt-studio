import { expect, test } from "bun:test";
import { prepareWorkbenchDocument } from "./workbench-loading";

const runtime = (origin: string) => ({ origin, token: "isolated-workbench-test" });

test("a failed login releases its document navigation before Retry can start", async () => {
  const navigation = Promise.withResolvers<void>();
  let navigating = false;
  const server = Bun.serve({ port: 0, fetch: () => new Response(null, { status: 500 }) });
  const contents = {
    async loadURL() {
      navigating = true;
      try {
        await navigation.promise;
      } finally {
        navigating = false;
      }
    },
    async executeJavaScript() {},
    stop: () => navigation.reject(new Error("Navigation stopped")),
  };
  try {
    await expect(prepareWorkbenchDocument(contents, runtime(server.url.origin))).rejects.toThrow(
      "Runtime browser login failed with status 500",
    );
    expect(navigating).toBe(false);
  } finally {
    navigation.resolve();
    server.stop(true);
  }
});

test("a failed document releases its login request and retains the navigation error", async () => {
  const requested = Promise.withResolvers<void>();
  const response = Promise.withResolvers<Response>();
  const failure = new Error("Document navigation failed");
  let requesting = false;
  const server = Bun.serve({
    port: 0,
    async fetch() {
      requested.resolve();
      return response.promise;
    },
  });
  const contents = {
    async loadURL() {
      await requested.promise;
      throw failure;
    },
    async executeJavaScript() {},
    stop() {
      throw new Error("The document was already destroyed");
    },
  };
  const fetcher = async (input: string, init: RequestInit) => {
    requesting = true;
    try {
      return await fetch(input, init);
    } finally {
      requesting = false;
    }
  };
  try {
    await expect(prepareWorkbenchDocument(contents, runtime(server.url.origin), fetcher)).rejects.toBe(failure);
    expect(requesting).toBe(false);
  } finally {
    response.resolve(new Response(null, { status: 500 }));
    server.stop(true);
  }
});
