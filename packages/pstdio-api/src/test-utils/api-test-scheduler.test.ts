import { expect, test } from "bun:test";
import { runApiTestFiles } from "./api-test-scheduler";

for (const [platform, separator] of [
  ["POSIX", "/"],
  ["Windows", "\\"],
]) {
  test(`runs process discovery alone after shared workers finish with ${platform} paths`, async () => {
    const processDiscovery = ["src", "features", "extensions", "process-discovery.test.ts"].join(separator);
    const files = ["first.test.ts", processDiscovery, "last.test.ts"];
    const active = new Set<string>();
    const completed: string[] = [];
    const started: Array<{ file: string; active: string[]; completed: string[] }> = [];

    await runApiTestFiles(files, async (file) => {
      started.push({ file, active: [...active], completed: [...completed] });
      active.add(file);
      await new Promise((resolve) => setImmediate(resolve));
      active.delete(file);
      completed.push(file);
    });

    expect([...completed].sort()).toEqual([...files].sort());
    expect(started.find(({ file }) => file === processDiscovery)).toEqual({
      file: processDiscovery,
      active: [],
      completed: ["first.test.ts", "last.test.ts"],
    });
    expect(started.find(({ file }) => file === "last.test.ts")?.active).toContain("first.test.ts");
  });
}
