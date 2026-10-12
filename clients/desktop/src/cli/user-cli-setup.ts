import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

interface UserCliSetupOptions {
  /** The CLI bundled with the desktop app. */
  binary: string;
  home: string;
  /** The person's login shell, such as `/bin/zsh`. */
  shell: string;
  platform: NodeJS.Platform;
}

const MARKER = "# Prompt Studio: the pst command";

// Each shell reads a different startup file. macOS terminals open login shells, which read
// ~/.bash_profile; Linux terminals open interactive shells, which read ~/.bashrc.
const shellProfile = (shell: string, platform: NodeJS.Platform, home: string) => {
  switch (basename(shell)) {
    case "zsh":
      return { path: join(home, ".zshrc"), line: 'export PATH="$HOME/.pstdio/bin:$PATH"' };
    case "bash":
      return {
        path: join(home, platform === "darwin" ? ".bash_profile" : ".bashrc"),
        line: 'export PATH="$HOME/.pstdio/bin:$PATH"',
      };
    case "fish":
      return { path: join(home, ".config", "fish", "config.fish"), line: "set --export PATH $HOME/.pstdio/bin $PATH" };
    default:
      return null;
  }
};

const linkCommand = (binary: string, command: string) => {
  try {
    const entry = lstatSync(command);
    if (!entry.isSymbolicLink()) return "conflict" as const;
    if (readlinkSync(command) === binary) return "unchanged" as const;
    // The folder belongs to Prompt Studio, so a link to a moved or replaced app is ours to update.
    rmSync(command);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  mkdirSync(dirname(command), { recursive: true });
  symlinkSync(binary, command);
  return "linked" as const;
};

const addToPath = (profile: { path: string; line: string }) => {
  const content = existsSync(profile.path) ? readFileSync(profile.path, "utf8") : "";
  if (content.includes(".pstdio/bin")) return "present" as const;
  mkdirSync(dirname(profile.path), { recursive: true });
  const separator = content === "" || content.endsWith("\n") ? "" : "\n";
  appendFileSync(profile.path, `${separator}\n${MARKER}\n${profile.line}\n`);
  return "added" as const;
};

/**
 * Makes `pst` available in the person's terminals without administrator rights, the way the Bun
 * installer does: a link in a folder the person owns, and one PATH line in their shell's startup file.
 */
export const setupUserCli = ({ binary, home, shell, platform }: UserCliSetupOptions) => {
  const command = linkCommand(binary, join(home, ".pstdio", "bin", "pst"));
  const profile = shellProfile(shell, platform, home);
  if (!profile) return { command, profile: null, path: "unsupported-shell" as const };
  return { command, profile: profile.path, path: addToPath(profile) };
};
