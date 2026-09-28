import { execFile } from "node:child_process";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";
import { WindowsCliInstallation } from "./windows-cli-installation";

const execute = promisify(execFile);

export const windowsInstallerEvent = (platform: NodeJS.Platform, argv: string[]) => {
  if (platform !== "win32") return null;
  switch (argv[1]) {
    case "--squirrel-install":
      return "install";
    case "--squirrel-updated":
      return "updated";
    case "--squirrel-uninstall":
      return "uninstall";
    case "--squirrel-obsolete":
      return "obsolete";
    default:
      return null;
  }
};

export const runWindowsInstallerEvent = async (
  event: NonNullable<ReturnType<typeof windowsInstallerEvent>>,
  executable: string,
  resources: string,
) => {
  if (event === "obsolete") return;
  const installRoot = dirname(dirname(executable));
  const installation = new WindowsCliInstallation({
    installRoot,
    binary: join(resources, "bin", "pstdio.exe"),
  });
  if (event === "uninstall") await installation.uninstall();
  else await installation.install();
  const action = event === "uninstall" ? "removeShortcut" : "createShortcut";
  await execute(join(installRoot, "Update.exe"), [`--${action}=${basename(executable)}`], { windowsHide: true });
};
