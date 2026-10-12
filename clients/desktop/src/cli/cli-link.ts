interface CliPaths {
  binary: string;
  command: string;
}

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
