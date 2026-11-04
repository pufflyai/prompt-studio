import { chmod, cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Copy only installed extensions: the build home has its own database and machine identity.
export const prepareDeviceHome = async (home: string, defaults: string) => {
  await mkdir(home, { recursive: true, mode: 0o700 });
  await chmod(home, 0o700);
  const extensions = join(home, "extensions");
  await mkdir(extensions, { recursive: true, mode: 0o700 });
  for (const entry of await readdir(join(defaults, "extensions"), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const destination = join(extensions, entry.name);
    try {
      await stat(destination);
      continue;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const temporary = join(extensions, `.${entry.name}.${crypto.randomUUID()}`);
    try {
      await cp(join(defaults, "extensions", entry.name), temporary, { recursive: true });
      await rename(temporary, destination);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }
};

export const prepareBootstrapFile = async (home: string, source: string) => {
  const target = join(home, "cloud-bootstrap.json");
  try {
    await writeFile(target, await readFile(source), { mode: 0o600, flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  return target;
};
