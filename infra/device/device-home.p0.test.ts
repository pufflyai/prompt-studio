import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareDeviceHome } from "./device-home";

test("a fresh persistent home receives installed defaults without adopting the build device identity", async () => {
  const root = await mkdtemp(join(tmpdir(), "cloud-device-home-"));
  try {
    const defaults = join(root, "defaults");
    const home = join(root, "home");
    await mkdir(join(defaults, "extensions", "harness", "node_modules"), { recursive: true });
    await writeFile(join(defaults, "extensions", "harness", "node_modules", "agent"), "installed agent");
    await writeFile(join(defaults, "native-account.json"), "build credential");
    await prepareDeviceHome(home, defaults);
    expect(await readFile(join(home, "extensions", "harness", "node_modules", "agent"), "utf8")).toBe(
      "installed agent",
    );
    expect(await Bun.file(join(home, "native-account.json")).exists()).toBe(false);
    expect((await stat(home)).mode & 0o777).toBe(0o700);
    await writeFile(join(home, "extensions", "harness", "node_modules", "agent"), "user upgrade");
    await writeFile(join(home, "native-account.json"), "device's own credential");
    await prepareDeviceHome(home, defaults);
    expect(await readFile(join(home, "extensions", "harness", "node_modules", "agent"), "utf8")).toBe("user upgrade");
    expect(await readFile(join(home, "native-account.json"), "utf8")).toBe("device's own credential");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a read-only bootstrap source is copied privately without replacing a pending enrollment", async () => {
  const { prepareBootstrapFile } = await import("./device-home");
  const root = await mkdtemp(join(tmpdir(), "cloud-device-bootstrap-"));
  try {
    const source = join(root, "operator-secret");
    const home = join(root, "home");
    await mkdir(home, { mode: 0o700 });
    await writeFile(source, "single-use grant", { mode: 0o400 });
    const target = await prepareBootstrapFile(home, source);
    expect((await stat(target)).mode & 0o777).toBe(0o600);
    expect(await readFile(target, "utf8")).toBe("single-use grant");
    await rm(source);
    await writeFile(source, "new grant");
    expect(await prepareBootstrapFile(home, source)).toBe(target);
    expect(await readFile(target, "utf8")).toBe("single-use grant");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
