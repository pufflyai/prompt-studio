import { expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";

export async function expectPackagedDependencyBlockers(input: {
  baseUrl: string;
  projectId: string;
  headers: Record<string, string>;
  execute: (command: string, params: unknown) => Promise<unknown>;
}) {
  const { execute } = input;
  const parent = (await execute("create-ticket", { content: "# Contract prerequisite", status: "Todo" })) as {
    id: string;
    shorthand: string;
  };
  const child = (await execute("create-ticket", {
    content: "# Dependent contract",
    status: "Todo",
    dependsOn: [parent.id],
  })) as { id: string };
  expect(
    await execute("update-ticket", {
      id: child.id,
      blockedReason: `Complete ${parent.shorthand} before implementing this dependent contract.`,
    }),
  ).toMatchObject({ blockedReason: null, dependsOn: [parent.id] });
  const waiting = (await execute("timeline.plan.read", {})) as { sections: { rows: unknown[] }[] };
  expect(waiting.sections.flatMap(({ rows }) => rows)).toContainEqual(
    expect.objectContaining({ id: child.id, flags: expect.arrayContaining(["waiting"]) }),
  );
  await execute("update-ticket", { id: child.id, blockedReason: "Needs credentials" });
  await execute("update-ticket", { id: parent.id, status: "Done" });
  expect(await execute("get-ticket", { id: child.id })).toMatchObject({
    blockedReason: "Needs credentials",
    dependsOn: [parent.id],
  });
  const cleared = spawnSync(
    PACKAGED_BINARY_PATH,
    ["tickets", "update", "--project-id", input.projectId, "--id", child.id, "--blocked-reason", ""],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PSTDIO_API_URL: input.baseUrl,
        PSTDIO_API_TOKEN: input.headers.authorization!.replace(/^Bearer /, ""),
      },
    },
  );
  expect(cleared.status, cleared.stderr).toBe(0);
  expect(JSON.parse(cleared.stdout)).toMatchObject({ blockedReason: null, dependsOn: [parent.id] });
  await execute("delete-ticket", { id: child.id });
  await execute("delete-ticket", { id: parent.id });
}
