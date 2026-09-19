import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveRuntimeEnvironment } from "./runtime-environment";

for (const shell of ["/bin/bash", "/bin/zsh", "/bin/csh", "/bin/tcsh"]) {
  test.skipIf(process.platform === "win32" || !existsSync(shell))(
    `loads interactive and login PATH configuration from ${shell}`,
    async () => {
      const home = mkdtempSync(join(tmpdir(), "desktop-login-shell-"));
      const interactivePath = join(home, "interactive tools");
      const loginPath = join(home, "login tools");
      writeFileSync(join(home, ".bashrc"), 'export PATH="$HOME/interactive tools:$PATH"\n');
      writeFileSync(join(home, ".bash_profile"), 'source "$HOME/.bashrc"\nexport PATH="$HOME/login tools:$PATH"\n');
      writeFileSync(join(home, ".zshrc"), 'export PATH="$HOME/interactive tools:$PATH"\n');
      writeFileSync(join(home, ".zprofile"), 'export PATH="$HOME/login tools:$PATH"\n');
      writeFileSync(join(home, ".cshrc"), 'setenv PATH "$HOME/interactive tools:$PATH"\n');
      writeFileSync(join(home, ".login"), 'setenv PATH "$HOME/login tools:$PATH"\n');
      try {
        const env = await resolveRuntimeEnvironment(AbortSignal.timeout(2_000), {
          HOME: home,
          ZDOTDIR: home,
          SHELL: shell,
          PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
        });
        expect(env.PATH?.split(":")).toContain(interactivePath);
        expect(env.PATH?.split(":")).toContain(loginPath);
      } finally {
        rmSync(home, { recursive: true, force: true });
      }
    },
  );
}

test("preserves the inherited Windows environment", async () => {
  const env = { PATH: "C:\\tools;C:\\Windows", PSTDIO_HOME: "C:\\runtime", SHELL: "/missing-shell" };
  expect(await resolveRuntimeEnvironment(new AbortController().signal, env, "win32")).toEqual(env);
});

test.skipIf(process.platform === "win32")("reports a shell that cannot start", async () => {
  await expect(resolveRuntimeEnvironment(new AbortController().signal, { SHELL: "/missing-shell" })).rejects.toThrow(
    "Could not load the executable search path from /missing-shell",
  );
});

test.skipIf(process.platform === "win32")("cancels shell startup with the runtime startup signal", async () => {
  const home = mkdtempSync(join(tmpdir(), "desktop-shell-cancel-"));
  writeFileSync(join(home, ".bash_profile"), "exec /bin/sleep 30\n");
  const controller = new AbortController();
  const reason = new Error("Runtime startup cancelled");
  const cancellation = setTimeout(() => controller.abort(reason), 50);
  try {
    await expect(
      resolveRuntimeEnvironment(controller.signal, { ...process.env, HOME: home, SHELL: "/bin/bash" }),
    ).rejects.toBe(reason);
  } finally {
    clearTimeout(cancellation);
    rmSync(home, { recursive: true, force: true });
  }
});
