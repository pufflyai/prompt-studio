import { describe, expect, test } from "bun:test";
import {
  addShader,
  deleteConfig,
  duplicateConfig,
  listConfigs,
  listShaders,
  readConfig,
  updateConfig,
} from "./configs";
import { defaultValues, findShader, normalizeValues } from "./shaders/definitions";

// An in-memory project folder with the parts of the file API that versions use.
const memoryFiles = () => {
  const files = new Map<string, string>();
  return {
    files,
    mount: {
      exists: async (path: string) => files.has(path),
      readText: async (path: string) => files.get(path) ?? "",
      writeText: async (path: string, value: string) => void files.set(path, value),
      delete: async (path: string) => void files.delete(path),
      list: async (pattern = "**/*") => {
        const expression = new RegExp(`^${pattern.replaceAll(".", "\\.").replaceAll("*", "[^/]*")}$`);
        return [...files.keys()].filter((path) => expression.test(path)).map((path) => ({ path }));
      },
    },
  };
};

const hatch = findShader("section-hatch");

describe("shader values", () => {
  test("missing values use the shader's defaults and out-of-range values are clamped", () => {
    const values = normalizeValues(hatch, { spacing: 999, darkOpacity: -1, extra: 3 });
    expect(values.spacing).toBe(32);
    expect(values.darkOpacity).toBe(0);
    expect(values.angle).toBe(defaultValues(hatch).angle);
    expect("extra" in values).toBe(false);
  });
});

describe("shader versions", () => {
  test("a shader is in the lab only while it has saved versions", async () => {
    const { mount } = memoryFiles();
    expect(await listShaders(mount)).toEqual([]);
    await addShader(mount, hatch);
    expect((await listShaders(mount)).map((shader) => shader.id)).toEqual(["section-hatch"]);
    expect(await listConfigs(mount, hatch)).toEqual([
      { shader: "section-hatch", id: "default", name: "Default", values: defaultValues(hatch) },
    ]);
  });

  test("edits are saved to the version's file", async () => {
    const { files, mount } = memoryFiles();
    await addShader(mount, hatch);
    await updateConfig(mount, hatch, "default", { values: { noiseScale: 320 } });
    expect(JSON.parse(files.get("design/shaders/section-hatch/default.json") ?? "{}").values.noiseScale).toBe(320);
    expect((await readConfig(mount, hatch, "default")).values.noiseScale).toBe(320);
  });

  test("duplicating copies the values under a new unique version", async () => {
    const { mount } = memoryFiles();
    await addShader(mount, hatch);
    await updateConfig(mount, hatch, "default", { values: { spacing: 12 } });
    const first = await duplicateConfig(mount, hatch, "default", "Soft patches");
    const second = await duplicateConfig(mount, hatch, "default", "Soft patches");
    expect(first).toMatchObject({ id: "soft-patches", name: "Soft patches" });
    expect(second.id).toBe("soft-patches-2");
    expect(first.values.spacing).toBe(12);
    expect((await listConfigs(mount, hatch)).map((config) => config.id)).toEqual([
      "default",
      "soft-patches",
      "soft-patches-2",
    ]);
  });

  test("renaming keeps the version id and values", async () => {
    const { mount } = memoryFiles();
    await addShader(mount, hatch);
    await updateConfig(mount, hatch, "default", { values: { spacing: 12 } });
    const renamed = await updateConfig(mount, hatch, "default", { name: "Baseline" });
    expect(renamed).toMatchObject({ id: "default", name: "Baseline" });
    expect(renamed.values.spacing).toBe(12);
  });

  test("deleting the last version removes the shader from the lab", async () => {
    const { mount } = memoryFiles();
    await addShader(mount, hatch);
    await deleteConfig(mount, hatch, "default");
    await expect(readConfig(mount, hatch, "default")).rejects.toThrow('Version "default"');
    expect(await listShaders(mount)).toEqual([]);
  });
});

test("shader values follow declared field steps while keeping fractional fields", () => {
  const ruler = normalizeValues(findShader("ruler-ticks"), { tickSpacing: 4.5, majorEvery: 5.2 });
  expect(ruler.tickSpacing).toBe(5);
  expect(ruler.majorEvery).toBe(5);
  const hatchValues = normalizeValues(hatch, { lineWidth: 1.25, lineDrift: 3.5 });
  expect(hatchValues.lineWidth).toBe(1.25);
  expect(hatchValues.lineDrift).toBe(3.5);
});
