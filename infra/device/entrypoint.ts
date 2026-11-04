import { prepareBootstrapFile, prepareDeviceHome } from "./device-home";

export const runDevice = async (input: { home: string; defaults: string; command?: string[] }) => {
  await prepareDeviceHome(input.home, input.defaults);
  const env: NodeJS.ProcessEnv = { ...process.env, PSTDIO_HOME: input.home };
  if (process.env.PSTDIO_CLOUD_BOOTSTRAP_SOURCE)
    env.PSTDIO_CLOUD_BOOTSTRAP_FILE = await prepareBootstrapFile(input.home, process.env.PSTDIO_CLOUD_BOOTSTRAP_SOURCE);
  const child = Bun.spawn(
    [
      ...(input.command ?? ["pstdio"]),
      "serve",
      "--foreground",
      "--owner",
      "persistent",
      "--host",
      "127.0.0.1",
      "--port",
      "19840",
    ],
    { env, stdin: "ignore", stdout: "inherit", stderr: "inherit" },
  );
  const stop = () => child.kill("SIGTERM");
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  try {
    return await child.exited;
  } finally {
    process.off("SIGTERM", stop);
    process.off("SIGINT", stop);
  }
};

if (import.meta.main)
  process.exitCode = await runDevice({
    home: process.env.PSTDIO_HOME ?? "/home/bun/.pstdio",
    defaults: "/opt/pstdio-defaults",
  });
