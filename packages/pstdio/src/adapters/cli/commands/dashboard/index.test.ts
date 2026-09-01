import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { launch } from ".";

let stdoutWriteSpy: ReturnType<typeof mock>;
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
let previousApiUrl: string | undefined;

beforeEach(() => {
  stdoutWriteSpy = mock((_chunk: unknown) => true);
  process.stdout.write = stdoutWriteSpy as typeof process.stdout.write;
  previousApiUrl = process.env.PSTDIO_API_URL;
});

afterEach(() => {
  process.stdout.write = originalStdoutWrite;
  if (previousApiUrl === undefined) delete process.env.PSTDIO_API_URL;
  else process.env.PSTDIO_API_URL = previousApiUrl;
});

const createDeps = () => {
  const openBrowser: string[] = [];
  return { openBrowser, deps: { openBrowser: (url: string) => openBrowser.push(url) } };
};

describe("launch", () => {
  test("opens the runtime origin published by the API auto-start middleware", async () => {
    const { openBrowser, deps } = createDeps();
    process.env.PSTDIO_API_URL = "http://127.0.0.1:43123";

    await launch({ apiPort: 19840, openBrowser: true }, deps);

    expect(openBrowser).toEqual(["http://127.0.0.1:43123"]);
    expect(stdoutWriteSpy).toHaveBeenCalledWith("Dashboard: http://127.0.0.1:43123\n");
    expect(stdoutWriteSpy).toHaveBeenCalledWith("API:       http://127.0.0.1:43123/v1\n");
  });

  test("falls back to 127.0.0.1:<api-port> when PSTDIO_API_URL is unset", async () => {
    const { openBrowser, deps } = createDeps();
    delete process.env.PSTDIO_API_URL;

    await launch({ apiPort: 3000, openBrowser: true }, deps);

    expect(openBrowser).toEqual(["http://127.0.0.1:3000"]);
  });

  test("does not open the browser when disabled", async () => {
    const { openBrowser, deps } = createDeps();
    process.env.PSTDIO_API_URL = "http://127.0.0.1:43123";

    await launch({ apiPort: 19840, openBrowser: false }, deps);

    expect(openBrowser).toEqual([]);
  });
});
