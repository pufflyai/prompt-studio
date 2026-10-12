interface CliPaths {
  binary: string;
  command: string;
}

// The DEB package links the command while it installs, so the app itself does not set one up.
export const DEB_CLI_PATHS = { binary: "/usr/lib/prompt-studio/resources/bin/pstdio", command: "/usr/bin/pst" };

const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const pathsScript = (paths: CliPaths) => `binary=${quote(paths.binary)}
command=${quote(paths.command)}
`;

export const cliInstallScript = (paths: CliPaths) => `${pathsScript(paths)}
test -x "$binary"
mkdir -p "$(dirname "$command")"
if [ -e "$command" ] || [ -L "$command" ]; then
  if [ "$(readlink "$command" || true)" != "$binary" ]; then
    printf '%s\\n' "Keeping existing command: $command"
  fi
else
  ln -s "$binary" "$command"
fi
`;

export const cliRemoveScript = (paths: CliPaths) => `${pathsScript(paths)}
if [ -L "$command" ] && [ "$(readlink "$command")" = "$binary" ]; then
  rm "$command"
fi
`;
