/**
 * Lets a test observe and pause extension handler code, which runs in a worker process and so
 * cannot reach the test's own objects. The handler calls the probe with a value; the test's
 * current answer runs in the test process and its result goes back to the handler.
 */
export const createExtensionProbe = () => {
  let answer: (value: unknown) => unknown = () => null;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    // A paused handler may wait longer than Bun's default idle timeout.
    idleTimeout: 0,
    fetch: async (request) => Response.json((await answer(await request.json())) ?? null),
  });
  /** Extension source for a promise of the probe's answer to `value`. */
  const request = (value: string) =>
    `fetch(${JSON.stringify(server.url.href)}, { method: "POST", body: JSON.stringify(${value} ?? null) }).then((response) => response.json())`;
  return {
    request,
    /** Extension source that calls the probe with `value` and awaits its answer. */
    call: (value: string) => `(await ${request(value)})`,
    answer: (next: (value: unknown) => unknown) => {
      answer = next;
    },
    stop: () => server.stop(true),
  };
};
