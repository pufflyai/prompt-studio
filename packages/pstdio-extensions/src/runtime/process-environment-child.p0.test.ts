import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionProcessEnvironment } from "./process-environment";

test("a native extension child receives its Windows profile without host credentials", async () => {
  const profile = mkdtempSync(join(tmpdir(), "pstdio-process-profile-"));
  const roaming = join(profile, "Roaming");
  const local = join(profile, "Local");
  mkdirSync(roaming);
  mkdirSync(local);
  let stop = async () => {};
  try {
    const env = createExtensionProcessEnvironment(
      {
        ...process.env,
        USERPROFILE: profile,
        PSModulePath: profile,
        APPDATA: roaming,
        LOCALAPPDATA: local,
        OPENAI_API_KEY: "host-only-fixture",
      },
      {},
      "win32",
    );
    const child = Bun.spawn(
      [
        process.execPath,
        "-e",
        "console.log(JSON.stringify({profile:process.env.USERPROFILE,modules:process.env.PSModulePath,roaming:process.env.APPDATA,local:process.env.LOCALAPPDATA,secret:process.env.OPENAI_API_KEY}))",
      ],
      { env, stdout: "pipe", stderr: "pipe" },
    );
    stop = async () => {
      if (child.exitCode === null) child.kill();
      await child.exited;
    };
    const [output, error, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect({ exitCode, error }).toEqual({ exitCode: 0, error: "" });
    expect(JSON.parse(output)).toEqual({ profile, modules: profile, roaming, local });
  } finally {
    await stop();
    rmSync(profile, { recursive: true, force: true });
  }
});
