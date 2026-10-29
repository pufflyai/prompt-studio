import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("detects harnesses for later projects after setup has completed", async () => {
  const root = await mkdtemp(join(tmpdir(), "onboarding-harnesses-"));
  try {
    if (process.platform === "win32") {
      await writeFile(join(root, "codex.cmd"), "@echo off\r\necho codex 1.0.0\r\n");
    } else {
      await writeFile(join(root, "codex"), `#!${process.execPath}\nconsole.log("codex 1.0.0");\n`, { mode: 0o755 });
    }
    // A new process gives PATH detection a real host environment without changing the test runner's PATH.
    const child = Bun.spawn(
      [
        process.execPath,
        "--eval",
        `import { createOnboarding } from ${JSON.stringify(import.meta.resolve("./onboarding"))};
       import { createOnboardingRoutes } from ${JSON.stringify(import.meta.resolve("./routes"))};
       const onboarding = createOnboarding({path: ${JSON.stringify(join(root, "onboarding.json"))}, enqueue: () => {}});
       await onboarding.update({step: "skip"});
       const routes = createOnboardingRoutes({onboarding});
       const visible = await (await routes.request("/onboarding")).json();
       await onboarding.update({step: "visibility", hidden: true});
       const hidden = await (await routes.request("/onboarding")).json();
       console.log(JSON.stringify({visible, hidden}));`,
      ],
      { env: { ...process.env, PATH: root }, stdout: "pipe", stderr: "pipe" },
    );
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect({ stderr, exitCode }).toEqual({ stderr: "", exitCode: 0 });
    const { visible, hidden } = JSON.parse(stdout);
    expect(visible).toMatchObject({ state: { completed: true }, detectedHarnesses: ["codex"] });
    expect(hidden).toMatchObject({ detectedHarnesses: [] });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
