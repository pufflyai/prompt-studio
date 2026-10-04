import { expect, test } from "bun:test";

test("the Codex fixture answers model discovery before a session starts", async () => {
  const child = Bun.spawn([process.execPath, `${import.meta.dir}/sessions-create-codex.fixture.ts`], {
    stdin: new Blob([JSON.stringify({ id: 1, method: "model/list", params: {} })]),
    stdout: "pipe",
  });
  const output = await new Response(child.stdout).text();
  expect(await child.exited).toBe(0);
  expect(JSON.parse(output)).toMatchObject({ id: 1, result: { data: [{ id: "gpt-5.5" }] } });
});
