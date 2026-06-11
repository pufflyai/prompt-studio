import { afterEach, describe, expect, test } from "bun:test";
import { mockFetchSSE } from "@/test-utils/mock-fetch";
import { getCollection } from "./collections";
import { startSync } from "./sync-client";

const waitFor = async (condition: () => boolean, timeout = 1000) => {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 1));
  }
};

let activeStream: ReturnType<typeof mockFetchSSE> | null = null;

afterEach(() => {
  activeStream?.close();
  activeStream = null;
});

const setupSSE = () => {
  activeStream = mockFetchSSE();
  return activeStream;
};

describe("startSync", () => {
  test("connects to the SSE stream", async () => {
    setupSSE();
    const client = startSync("http://localhost:3000");

    expect(globalThis.fetch).toHaveBeenCalledWith("http://localhost:3000/v1/sync/stream", expect.any(Object));

    client.close();
  });

  test("populates collections on init event", async () => {
    const stream = setupSSE();
    const client = startSync("http://localhost:3000");

    stream.send("init", {
      tables: {
        projects: [
          { id: "p1", name: "Project 1" },
          { id: "p2", name: "Project 2" },
        ],
        templates: [{ id: "t1", name: "Template 1" }],
      },
      seq: 5,
    });

    await waitFor(() => getCollection("projects").state.size === 2);

    const projectsCol = getCollection("projects");
    expect(projectsCol.state.size).toBe(2);
    expect(projectsCol.get("p1")?.name).toBe("Project 1");

    const templatesCol = getCollection("templates");
    expect(templatesCol.state.size).toBe(1);

    expect(client.connected).toBe(true);
    client.close();
  });

  test("handles sync:set events for new items", async () => {
    const stream = setupSSE();
    const client = startSync("http://localhost:3000");

    stream.send("init", { tables: { projects: [] }, seq: 0 });
    stream.send("sync:set", { table: "projects", data: { id: "p1", name: "New Project" }, seq: 1 });

    await waitFor(() => getCollection("projects").state.size === 1);

    const col = getCollection("projects");
    expect(col.state.size).toBe(1);
    expect(col.get("p1")?.name).toBe("New Project");
    client.close();
  });

  test("handles sync:delete events", async () => {
    const stream = setupSSE();
    const client = startSync("http://localhost:3000");

    stream.send("init", { tables: { projects: [{ id: "p1", name: "To Delete" }] }, seq: 0 });
    stream.send("sync:delete", { table: "projects", id: "p1", seq: 1 });

    await waitFor(() => getCollection("projects").state.size === 0);

    const col = getCollection("projects");
    expect(col.state.size).toBe(0);
    client.close();
  });

  test("disconnects on close()", () => {
    setupSSE();
    const client = startSync("http://localhost:3000");

    client.close();

    expect(client.connected).toBe(false);
  });
});
