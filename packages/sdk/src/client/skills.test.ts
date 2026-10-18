import { expect, test } from "bun:test";
import { createClient } from "./client";

test("skill lookups preserve reserved characters in project and skill names", async () => {
  const names: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const parts = new URL(request.url).pathname.split("/");
      names.push(decodeURIComponent(parts.at(-1)!));
      return Response.json({ name: names.at(-1) });
    },
  });
  try {
    const { skills } = createClient({ baseUrl: server.url.origin });
    const name = "notes/#? research";
    expect((await skills.get("project/a", name)).name).toBe(name);
    await skills.updatePreferences("project/a", name, { enabled: false });
    expect(names).toEqual([name, name]);
  } finally {
    server.stop(true);
  }
});
