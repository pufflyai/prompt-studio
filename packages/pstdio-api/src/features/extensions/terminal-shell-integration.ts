import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const marker = (id: string, state: string) => `\\033]633;PSTDIO=${id};${state}\\007`;

const bashInit = (id: string, readUserConfig: boolean) => `
${readUserConfig ? "[[ -r ~/.bashrc ]] && source ~/.bashrc" : ""}
# An existing DEBUG trap belongs to the user. Leave this shell conservatively active.
if [[ -z $(trap -p DEBUG) ]]; then
  _pstdio_prompt() {
    local status=$?
    local marker='\\[${marker(id, "prompt")}\\]'
    if [[ $PS1 != *"$marker"* ]]; then PS1="$PS1$marker"; fi
    _pstdio_running=0
    return "$status"
  }
  if [[ $(declare -p PROMPT_COMMAND 2>/dev/null) == "declare -a"* ]]; then
    PROMPT_COMMAND+=(_pstdio_prompt)
  else
    PROMPT_COMMAND="$PROMPT_COMMAND"$'\\n''_pstdio_prompt'
  fi
  trap ${quote(`if [[ $_pstdio_running != 1 ]]; then _pstdio_running=1; builtin printf '${marker(id, "busy")}'; fi`)} DEBUG
fi
`;

const zshInit = (id: string) => `
_pstdio_prompt() {
  local marker=$'${marker(id, "prompt")}'
  if [[ $PS1 != *$marker* ]]; then PS1="$PS1%{$marker%}"; fi
}
_pstdio_busy() { builtin printf '${marker(id, "busy")}'; }
precmd_functions=(_pstdio_busy \${precmd_functions:#_pstdio_busy} _pstdio_prompt)
preexec_functions=(_pstdio_busy \${preexec_functions:#_pstdio_busy})
`;

const restoreZdotdir = `
if [[ \${_pstdio_zdotdir_set} == 1 ]]; then
  export ZDOTDIR=$_pstdio_zdotdir
else
  unset ZDOTDIR
fi
`;
const saveZdotdir = `
_pstdio_zdotdir_set=\${+ZDOTDIR}
_pstdio_zdotdir=\${ZDOTDIR-}
`;

export const prepareTerminalShell = (command: string[], env: Record<string, string | undefined>, id: string) => {
  const shell = basename(command[0]);
  const args = command.slice(1);
  // Preserve custom invocations exactly; without supported hooks they stay active.
  const bash = shell === "bash" && args.every((arg) => arg === "-i" || arg === "--norc");
  const zsh = shell === "zsh" && args.every((arg) => /^-[ifld]+$/.test(arg));
  if (process.platform === "win32" || (!bash && !zsh)) return { command, env, dispose() {} };

  const root = mkdtempSync(join(tmpdir(), "pstdio-terminal-shell-"));
  const dispose = () => rmSync(root, { recursive: true, force: true });
  try {
    if (bash) {
      const rc = join(root, "bashrc");
      writeFileSync(rc, bashInit(id, !args.includes("--norc")));
      return { command: [command[0], "--rcfile", rc, "-i"], env, dispose };
    }

    const noRc = args.some((arg) => arg.includes("f"));
    const initialZdotdir = env.ZDOTDIR === undefined ? "unset ZDOTDIR" : `export ZDOTDIR=${quote(env.ZDOTDIR)}`;
    writeFileSync(
      join(root, ".zshenv"),
      `
${initialZdotdir}
${noRc ? "unsetopt GLOBAL_RCS" : `[[ -r \${ZDOTDIR:-$HOME}/.zshenv ]] && source "\${ZDOTDIR:-$HOME}/.zshenv"`}
${saveZdotdir}
[[ -o rcs ]] && export ZDOTDIR=${quote(root)}
`,
    );
    for (const file of [".zprofile", ".zshrc", ".zlogin"]) {
      const continueStartup = file === ".zprofile" || file === ".zshrc";
      writeFileSync(
        join(root, file),
        `
${restoreZdotdir}
${noRc ? "" : `[[ -r \${ZDOTDIR:-$HOME}/${file} ]] && source "\${ZDOTDIR:-$HOME}/${file}"`}
${file === ".zshrc" ? zshInit(id) : ""}
${saveZdotdir}
${continueStartup ? `[[ -o login && -o rcs ]] && export ZDOTDIR=${quote(root)}` : ""}
`,
      );
    }
    const supportedArgs = args.map((arg) => arg.replaceAll("f", "")).filter((arg) => arg !== "-");
    return { command: [command[0], ...supportedArgs, "-i"], env: { ...env, ZDOTDIR: root }, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
};
