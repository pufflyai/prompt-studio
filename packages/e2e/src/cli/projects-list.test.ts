import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createProjectViaApi, runPstdio } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";

let api: ApiInstance;

beforeAll(async () => {
  api = await startApi();
}, 20_000);

afterAll(() => {
  api?.stop();
});

const run = (args: string) => runPstdio(args, process.cwd(), { PSTDIO_API_URL: api.url });

describe("pstdio projects list", () => {
  test("shows empty message when no projects exist", () => {
    const output = run("projects list");

    expect(output).toContain("No projects found");
  });

  test("shows table with project after creation", async () => {
    const project = await createProjectViaApi(api.url, "list-test-project");

    const output = run("projects list");

    expect(output).toContain("ID");
    expect(output).toContain("Name");
    expect(output).toContain(project.id);
    expect(output).toContain("list-test-project");
  });
});
