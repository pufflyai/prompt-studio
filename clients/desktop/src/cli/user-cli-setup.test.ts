import { afterEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { setupUserCli } from "./user-cli-setup";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "user-cli-"));
  roots.push(root);
  const home = join(root, "home");
  const binary = join(root, "Prompt Studio.app", "Contents", "Resources", "bin", "pstdio");
  mkdirSync(home);
  mkdirSync(dirname(binary), { recursive: true });
  symlinkSync(process.execPath, binary);
  return { root, home, binary, command: join(home, ".pstdio", "bin", "pst") };
};

test("links pst in the user's bin folder and adds it to the zsh PATH", () => {
  const { home, binary, command } = fixture();

  expect(setupUserCli({ binary, home, shell: "/bin/zsh", platform: "darwin" })).toEqual({
    command: "linked",
    profile: join(home, ".zshrc"),
    path: "added",
  });
  expect(readlinkSync(command)).toBe(binary);
  expect(readFileSync(join(home, ".zshrc"), "utf8")).toContain('export PATH="$HOME/.pstdio/bin:$PATH"');
});

test("changes nothing when the command and PATH line are already set up", () => {
  const { home, binary } = fixture();
  setupUserCli({ binary, home, shell: "/bin/zsh", platform: "darwin" });
  const profile = readFileSync(join(home, ".zshrc"), "utf8");

  expect(setupUserCli({ binary, home, shell: "/bin/zsh", platform: "darwin" })).toEqual({
    command: "unchanged",
    profile: join(home, ".zshrc"),
    path: "present",
  });
  expect(readFileSync(join(home, ".zshrc"), "utf8")).toBe(profile);
});

test("keeps the person's existing profile content and adds the line after it", () => {
  const { home, binary } = fixture();
  writeFileSync(join(home, ".zshrc"), 'alias ll="ls -l"');

  setupUserCli({ binary, home, shell: "/bin/zsh", platform: "darwin" });

  const profile = readFileSync(join(home, ".zshrc"), "utf8");
  expect(profile.startsWith('alias ll="ls -l"\n')).toBe(true);
  expect(profile).toContain('export PATH="$HOME/.pstdio/bin:$PATH"');
});

test("uses the bash profile that each platform's terminals read", () => {
  const mac = fixture();
  const linux = fixture();

  expect(setupUserCli({ ...mac, shell: "/bin/bash", platform: "darwin" }).profile).toBe(
    join(mac.home, ".bash_profile"),
  );
  expect(setupUserCli({ ...linux, shell: "/usr/bin/bash", platform: "linux" }).profile).toBe(
    join(linux.home, ".bashrc"),
  );
});

test("a new bash shell finds pst after setup", () => {
  const { home, binary, command } = fixture();
  setupUserCli({ binary, home, shell: "/bin/bash", platform: "linux" });

  const result = spawnSync("bash", ["-c", '. "$HOME/.bashrc"; command -v pst'], {
    env: { HOME: home, PATH: "/usr/bin:/bin" },
    encoding: "utf8",
  });

  expect(result.stdout.trim()).toBe(command);
});

test("adds the fish PATH line to the fish config", () => {
  const { home, binary } = fixture();

  const result = setupUserCli({ binary, home, shell: "/opt/homebrew/bin/fish", platform: "darwin" });

  expect(result.profile).toBe(join(home, ".config", "fish", "config.fish"));
  expect(readFileSync(join(home, ".config", "fish", "config.fish"), "utf8")).toContain(
    "set --export PATH $HOME/.pstdio/bin $PATH",
  );
});

test("relinks pst when the app moved", () => {
  const { home, binary, command } = fixture();
  mkdirSync(dirname(command), { recursive: true });
  symlinkSync("/Volumes/Prompt Studio/Prompt Studio.app/Contents/Resources/bin/pstdio", command);

  expect(setupUserCli({ binary, home, shell: "/bin/zsh", platform: "darwin" }).command).toBe("linked");
  expect(readlinkSync(command)).toBe(binary);
});

test("keeps a pst file in the bin folder that is not a link", () => {
  const { home, binary, command } = fixture();
  mkdirSync(dirname(command), { recursive: true });
  writeFileSync(command, "#!/bin/sh\necho custom\n");

  expect(setupUserCli({ binary, home, shell: "/bin/zsh", platform: "darwin" }).command).toBe("conflict");
  expect(readFileSync(command, "utf8")).toBe("#!/bin/sh\necho custom\n");
});

test("links pst but edits no file for a shell it does not know", () => {
  const { home, binary, command } = fixture();

  expect(setupUserCli({ binary, home, shell: "/bin/tcsh", platform: "linux" })).toEqual({
    command: "linked",
    profile: null,
    path: "unsupported-shell",
  });
  expect(readlinkSync(command)).toBe(binary);
});
