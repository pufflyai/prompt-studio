import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cliInstallScript, cliRemoveScript, DEB_CLI_PATHS } from "../cli/cli-link";

export const writeCliInstallScripts = (directory: string) => {
  const deb = join(directory, "debian");
  mkdirSync(deb, { recursive: true });
  const write = (path: string, script: string) => writeFileSync(path, `#!/bin/sh\nset -eu\n${script}`, { mode: 0o755 });
  write(join(deb, "postinst"), `if [ "$1" = configure ]; then\n${cliInstallScript(DEB_CLI_PATHS)}fi\n`);
  write(join(deb, "postrm"), `case "$1" in remove|purge)\n${cliRemoveScript(DEB_CLI_PATHS)};;\nesac\n`);
  return deb;
};
