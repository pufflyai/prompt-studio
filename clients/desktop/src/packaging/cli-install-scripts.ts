import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cliInstallScript, cliRemoveScript } from "../cli/cli-link";

export const writeCliInstallScripts = (directory: string) => {
  const deb = join(directory, "debian");
  mkdirSync(deb, { recursive: true });
  const debPaths = { binary: "/usr/lib/prompt-studio/resources/bin/pstdio", command: "/usr/bin/pst" };
  const write = (path: string, script: string) => writeFileSync(path, `#!/bin/sh\nset -eu\n${script}`, { mode: 0o755 });
  write(join(deb, "postinst"), `if [ "$1" = configure ]; then\n${cliInstallScript(debPaths)}fi\n`);
  write(join(deb, "postrm"), `case "$1" in remove|purge)\n${cliRemoveScript(debPaths)};;\nesac\n`);
  return deb;
};
