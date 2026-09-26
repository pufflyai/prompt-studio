import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { createTerminalSupervisor } from "./extension-terminal-runtime";

const shells = [
  ["/bin/bash", "--norc", "-i"],
  ["/bin/zsh", "-f", "-i"],
].filter(([shell]) => existsSync(shell));
const waitFor = async (predicate: () => boolean) => {
  for (let i = 0; i < 100 && !predicate(); i++) await Bun.sleep(10);
  expect(predicate()).toBe(true);
};

test.each(shells)("tracks builtin work and returns to the prompt in %s", async (...command) => {
  const root = mkdtempSync(join(tmpdir(), "terminal-builtins-"));
  writeFileSync(join(root, "loop.sh"), "printf 'LOOP_STARTED\\n'; while :; do :; done\n");
  const supervisor = createTerminalSupervisor({ logger: { info() {}, warn() {}, error() {} } });
  const terminal = supervisor.api.openSession({ command, cwd: root, cols: 80, rows: 24 });
  let output = "";
  void (async () => {
    for await (const event of terminal.events())
      if (event.kind === "data") output += new TextDecoder().decode(event.chunk);
  })();
  try {
    await waitFor(() => supervisor.activity().length === 0);
    terminal.write("echo not-submitted");
    await Bun.sleep(20);
    expect(supervisor.activity()).toEqual([]);
    terminal.write("\x15");
    expect(supervisor.activity()).toEqual([]);
    terminal.write("printf 'READ_%s\\n' STARTED; read answer\n");
    await waitFor(() => output.includes("READ_STARTED"));
    expect(supervisor.activity()).toEqual([{ id: terminal.id, label: basename(command[0]) }]);
    terminal.write("finished\n");
    await waitFor(() => supervisor.activity().length === 0);
    terminal.write(". ./loop.sh\n");
    await waitFor(() => output.includes("LOOP_STARTED"));
    expect(supervisor.activity()).toEqual([{ id: terminal.id, label: basename(command[0]) }]);
    terminal.write("\x03");
    await waitFor(() => supervisor.activity().length === 0);
  } finally {
    await supervisor.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});

test.skipIf(!existsSync("/bin/zsh"))("preserves Zsh startup order, hooks, and redirected ZDOTDIR", async () => {
  const root = mkdtempSync(join(tmpdir(), "terminal-zsh-profile-"));
  const config = join(root, "config");
  mkdirSync(config);
  writeFileSync(join(root, ".zshenv"), 'export ZDOTDIR="$HOME/config"; export USER_STARTUP=env\n');
  writeFileSync(join(config, ".zprofile"), 'USER_STARTUP="$USER_STARTUP":profile\n');
  writeFileSync(
    join(config, ".zshrc"),
    `
USER_STARTUP="\${USER_STARTUP}:rc"
user_prompt() { PS1='custom> '; }
user_preexec() { builtin printf 'USER_HOOK\\n'; }
precmd_functions=(user_prompt)
preexec_functions=(user_preexec)
`,
  );
  writeFileSync(join(config, ".zlogin"), 'USER_STARTUP="$USER_STARTUP":login\n');
  const supervisor = createTerminalSupervisor({ logger: { info() {}, warn() {}, error() {} } });
  const terminal = supervisor.api.openSession({
    command: ["/bin/zsh", "-l"],
    env: { HOME: root, ZDOTDIR: root },
    cols: 80,
    rows: 24,
  });
  let output = "";
  void (async () => {
    for await (const event of terminal.events())
      if (event.kind === "data") output += new TextDecoder().decode(event.chunk);
  })();
  try {
    await waitFor(() => supervisor.activity().length === 0);
    terminal.write('printf \'RESULT:%s:%s\\n\' "$USER_STARTUP" "$ZDOTDIR"\n');
    await waitFor(() => output.includes(`RESULT:env:profile:rc:login:${config}`));
    expect(output).toContain("USER_HOOK");
    expect(output).toContain("custom> ");
    expect(output).not.toContain("PSTDIO=");
    await waitFor(() => supervisor.activity().length === 0);
  } finally {
    await supervisor.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});

test.skipIf(!existsSync("/bin/bash"))("preserves a user DEBUG trap and keeps its terminal active", async () => {
  const root = mkdtempSync(join(tmpdir(), "terminal-bash-debug-"));
  writeFileSync(join(root, ".bashrc"), `trap 'USER_DEBUG=kept' DEBUG\nPS1='debug> '\n`);
  const supervisor = createTerminalSupervisor({ logger: { info() {}, warn() {}, error() {} } });
  const terminal = supervisor.api.openSession({ command: ["/bin/bash"], env: { HOME: root }, cols: 80, rows: 24 });
  let output = "";
  void (async () => {
    for await (const event of terminal.events())
      if (event.kind === "data") output += new TextDecoder().decode(event.chunk);
  })();
  try {
    await waitFor(() => output.includes("debug> "));
    expect(supervisor.activity()).toHaveLength(1);
    terminal.write("printf 'DEBUG:%s\\n' \"$USER_DEBUG\"\n");
    await waitFor(() => output.includes("DEBUG:kept"));
    expect(supervisor.activity()).toHaveLength(1);
  } finally {
    await supervisor.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});

test.skipIf(!existsSync("/bin/bash")).each(['PS1="dynamic> "', 'PS1="dynamic> ";', 'PS1="dynamic> " # user comment'])(
  "preserves Bash startup, dynamic prompts, and command exit status (%s)",
  async (promptCommand) => {
    const root = mkdtempSync(join(tmpdir(), "terminal-bash-profile-"));
    writeFileSync(
      join(root, ".bashrc"),
      `
export USER_STARTUP=loaded
PROMPT_COMMAND='${promptCommand}'
`,
    );
    const supervisor = createTerminalSupervisor({ logger: { info() {}, warn() {}, error() {} } });
    const terminal = supervisor.api.openSession({ command: ["/bin/bash"], env: { HOME: root }, cols: 80, rows: 24 });
    let output = "";
    void (async () => {
      for await (const event of terminal.events())
        if (event.kind === "data") output += new TextDecoder().decode(event.chunk);
    })();
    try {
      await waitFor(() => output.includes("dynamic> "));
      expect(supervisor.activity()).toEqual([]);
      terminal.write("false\n");
      await waitFor(() => supervisor.activity().length === 0);
      terminal.write('printf \'RESULT:%s:%s\\n\' "$?" "$USER_STARTUP"\n');
      await waitFor(() => output.includes("RESULT:1:loaded"));
      await waitFor(() => supervisor.activity().length === 0);
      expect(output).not.toContain("PSTDIO=");
    } finally {
      await supervisor.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  },
);
