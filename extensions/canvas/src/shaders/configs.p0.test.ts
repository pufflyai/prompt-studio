import { describe, expect, test } from "bun:test";
import { defaultValues, normalizeValues, type ShaderDefinition } from "./catalog";
import {
  addShader,
  deleteConfig,
  duplicateConfig,
  listConfigs,
  listShaders,
  readConfig,
  updateConfig,
} from "./configs";

// An in-memory project folder with the parts of the file API that versions use.
const catalog: ShaderDefinition[] = [
  {
    id: "section-hatch",
    title: "Hatch",
    description: "Test surface",
    groups: [
      {
        fields: [
          { id: "spacing", min: 2, max: 32, step: 1, defaultValue: 8 },
          { id: "angle", min: 0, max: 180, step: 1, defaultValue: 45 },
          { id: "darkOpacity", min: 0, max: 1, step: 0.01, defaultValue: 0.2 },
          { id: "noiseScale", min: 1, max: 512, step: 1, defaultValue: 200 },
          { id: "lineWidth", min: 0.5, max: 3, step: 0.25, defaultValue: 1 },
          { id: "lineDrift", min: 0, max: 30, step: 0.5, defaultValue: 3 },
        ],
      },
    ],
  },
  {
    id: "ruler-ticks",
    title: "Ruler",
    description: "Test ruler",
    groups: [
      {
        fields: [
          { id: "tickSpacing", min: 1, max: 20, step: 1, defaultValue: 4 },
          { id: "majorEvery", min: 1, max: 10, step: 1, defaultValue: 5 },
        ],
      },
    ],
  },
];
const memoryFiles = () => {
  const files = new Map<string, string>([["design/shaders/catalog.json", JSON.stringify(catalog)]]);
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

const hatch = catalog.find((shader) => shader.id === "section-hatch")!;

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
  const ruler = normalizeValues(catalog.find((shader) => shader.id === "ruler-ticks")!, {
    tickSpacing: 4.5,
    majorEvery: 5.2,
  });
  expect(ruler.tickSpacing).toBe(5);
  expect(ruler.majorEvery).toBe(5);
  const hatchValues = normalizeValues(hatch, { lineWidth: 1.25, lineDrift: 3.5 });
  expect(hatchValues.lineWidth).toBe(1.25);
  expect(hatchValues.lineDrift).toBe(3.5);
});

test("version deletion keeps the authored Canvas import valid until the last version is removed", async () => {
  const { files, mount } = memoryFiles();
  const canvas = "design/shaders/section-hatch/shader.canvas.tsx";
  await addShader(mount, hatch);
  expect(files.get(canvas)).toContain("./default.json");
  await duplicateConfig(mount, hatch, "default", "Soft");
  await deleteConfig(mount, hatch, "default");
  expect(files.get(canvas)).toContain("./soft.json");
  await deleteConfig(mount, hatch, "soft");
  expect(files.has(canvas)).toBe(false);
});

test("adding an existing shader and unsafe version IDs never replace design data", async () => {
  const { mount } = memoryFiles();
  await addShader(mount, hatch);
  await updateConfig(mount, hatch, "default", { values: { spacing: 12 } });
  await expect(addShader(mount, hatch)).rejects.toThrow();
  await expect(deleteConfig(mount, hatch, "../../outside")).rejects.toThrow();
  expect((await readConfig(mount, hatch, "default")).values.spacing).toBe(12);
});

test("unsupported version filenames do not break the shader list or version edits", async () => {
  const { files, mount } = memoryFiles();
  await addShader(mount, hatch);
  files.set("design/shaders/section-hatch/-draft.json", "{}");
  expect((await listShaders(mount)).map((shader) => shader.id)).toEqual(["section-hatch"]);
  await duplicateConfig(mount, hatch, "default", "Alternative");
  expect((await listConfigs(mount, hatch)).map((version) => version.id)).toEqual(["default", "alternative"]);
});
