import type { ArtifactMount } from "@pstdio/sdk/extensions";
import {
  defaultFontEditorConfig,
  FONT_EDITOR_CONFIG_PATH,
  type FontEditorConfig,
  parseFontEditorConfig,
} from "../config";
import {
  addGlyph,
  buildFontArtifacts,
  type FontArtifact,
  type FontArtifacts,
  inspectFont,
  normalizeFontGlyphs,
  parseCssGlyphNames,
  removeGlyph,
  renameGlyph,
  setGlyphCodepoint,
  verifyFontArtifacts,
} from "../font/font-document";

type ConfigPatch = Partial<
  Pick<
    FontEditorConfig,
    "family" | "fileName" | "cssPrefix" | "fontsUrl" | "outputDir" | "cssFile" | "startCodepoint" | "endCodepoint"
  >
>;

interface AddRepositoryGlyphInput {
  name: string;
  svg: string;
  codepoint?: string;
}

const joinPath = (...parts: string[]) =>
  parts
    .map((part) => part.replace(/^\/|\/$/g, ""))
    .filter(Boolean)
    .join("/");
const outputPath = (config: FontEditorConfig, path: string) => joinPath(config.outputDir, path);

export const readRepositoryConfig = async (mount: ArtifactMount) => {
  if (!(await mount.exists(FONT_EDITOR_CONFIG_PATH))) return { ...defaultFontEditorConfig };
  return parseFontEditorConfig(await mount.readText(FONT_EDITOR_CONFIG_PATH));
};

const readNormalizedSource = async (mount: ArtifactMount, config: FontEditorConfig) => {
  const source = await mount.readBytes(config.source);
  const cssPath = outputPath(config, config.cssFile);
  if (!(await mount.exists(cssPath))) return source;
  const names = parseCssGlyphNames(await mount.readText(cssPath), config.cssPrefix);
  return normalizeFontGlyphs(source, names);
};

const buildAndVerify = async (source: Uint8Array, config: FontEditorConfig) => {
  const artifacts = await buildFontArtifacts(source, config);
  const verified = await verifyFontArtifacts(artifacts, config);
  return { artifacts, verified };
};

const artifactTargets = (artifacts: FontArtifacts, config: FontEditorConfig) =>
  Object.entries(artifacts).map(([path, value]) => ({
    path: outputPath(config, path),
    value,
  }));

const serializeConfig = (config: FontEditorConfig) => {
  const value = JSON.stringify(config, null, 2);
  const multilineFormats = JSON.stringify(config.formats, null, 2)
    .split("\n")
    .map((line, index) => (index === 0 ? line : `  ${line}`))
    .join("\n");
  const inlineFormats = `[${config.formats.map((format) => JSON.stringify(format)).join(", ")}]`;
  return `${value.replace(multilineFormats, inlineFormats)}\n`;
};

const restoreTarget = async (mount: ArtifactMount, target: { path: string; existed: boolean; value?: Uint8Array }) => {
  if (!target.existed) {
    await mount.delete(target.path);
    return;
  }
  await mount.writeBytes(target.path, target.value as Uint8Array);
};

const commit = async (mount: ArtifactMount, artifacts: FontArtifacts, config: FontEditorConfig) => {
  const targets = [
    ...artifactTargets(artifacts, config),
    { path: FONT_EDITOR_CONFIG_PATH, value: serializeConfig(config) },
  ];
  const snapshots = await Promise.all(
    targets.map(async ({ path }) => {
      const existed = await mount.exists(path);
      return { path, existed, value: existed ? await mount.readBytes(path) : undefined };
    }),
  );

  try {
    for (const target of targets) {
      if (typeof target.value === "string") await mount.writeText(target.path, target.value);
      else await mount.writeBytes(target.path, target.value);
    }
  } catch (error) {
    for (const snapshot of [...snapshots].reverse()) await restoreTarget(mount, snapshot);
    throw error;
  }
};

const applyMutation = async (
  mount: ArtifactMount,
  mutate: (source: Uint8Array, config: FontEditorConfig) => Promise<Uint8Array>,
) => {
  const config = await readRepositoryConfig(mount);
  const source = await readNormalizedSource(mount, config);
  const updated = await mutate(source, config);
  const { artifacts, verified } = await buildAndVerify(updated, config);
  await commit(mount, artifacts, config);
  return { config, source: artifacts[`${config.fileName}.ttf`] as Uint8Array, verified };
};

export const inspectRepositoryFont = async (mount: ArtifactMount) => {
  const config = await readRepositoryConfig(mount);
  return inspectFont(await readNormalizedSource(mount, config));
};

export const previewRepositoryFont = async (mount: ArtifactMount) => {
  const config = await readRepositoryConfig(mount);
  const source = await readNormalizedSource(mount, config);
  return {
    family: config.family,
    fontDataUrl: `data:font/ttf;base64,${Buffer.from(source).toString("base64")}`,
  };
};

export const buildRepositoryFont = async (mount: ArtifactMount) => {
  const config = await readRepositoryConfig(mount);
  const source = await readNormalizedSource(mount, config);
  const { artifacts, verified } = await buildAndVerify(source, config);
  await commit(mount, artifacts, config);
  return verified;
};

export const verifyRepositoryFont = async (mount: ArtifactMount) => {
  const config = await readRepositoryConfig(mount);
  const artifacts: FontArtifacts = {};
  for (const format of config.formats) {
    artifacts[`${config.fileName}.${format}`] = await mount.readBytes(
      outputPath(config, `${config.fileName}.${format}`),
    );
  }
  artifacts[config.cssFile] = await mount.readText(outputPath(config, config.cssFile));
  return verifyFontArtifacts(artifacts, config);
};

export const renameRepositoryGlyph = async (mount: ArtifactMount, identifier: string, name: string) => {
  const result = await applyMutation(mount, (source) => renameGlyph(source, identifier, name));
  const inspection = await inspectFont(result.source);
  return {
    ...result.verified,
    glyph: inspection.glyphs.find((glyph) => glyph.name === name) as (typeof inspection.glyphs)[number],
  };
};

export const setRepositoryGlyphCodepoint = async (mount: ArtifactMount, identifier: string, codepoint: string) => {
  const result = await applyMutation(mount, (source) => setGlyphCodepoint(source, identifier, codepoint));
  const inspection = await inspectFont(result.source);
  return {
    ...result.verified,
    glyph: inspection.glyphs.find(
      (glyph) => glyph.codepoint === codepoint.toUpperCase(),
    ) as (typeof inspection.glyphs)[number],
  };
};

export const removeRepositoryGlyph = async (mount: ArtifactMount, identifier: string) => {
  const result = await applyMutation(mount, (source) => removeGlyph(source, identifier));
  return result.verified;
};

export const addRepositoryGlyph = async (mount: ArtifactMount, input: AddRepositoryGlyphInput) => {
  const result = await applyMutation(mount, (source, config) =>
    addGlyph(source, {
      ...input,
      startCodepoint: config.startCodepoint,
      endCodepoint: config.endCodepoint,
    }),
  );
  const inspection = await inspectFont(result.source);
  return {
    ...result.verified,
    glyph: inspection.glyphs.find((glyph) => glyph.name === input.name) as (typeof inspection.glyphs)[number],
  };
};

export const updateRepositoryConfig = async (mount: ArtifactMount, patch: ConfigPatch) => {
  const current = await readRepositoryConfig(mount);
  const source = await readNormalizedSource(mount, current);
  const next = parseFontEditorConfig(
    JSON.stringify({
      ...current,
      ...patch,
      source: joinPath(patch.outputDir ?? current.outputDir, `${patch.fileName ?? current.fileName}.ttf`),
    }),
  );
  const { artifacts } = await buildAndVerify(source, next);
  await commit(mount, artifacts, next);
  return next;
};

export const readRepositoryArtifact = async (
  mount: ArtifactMount,
  config: FontEditorConfig,
  path: string,
): Promise<FontArtifact> => {
  const fullPath = outputPath(config, path);
  return path === config.cssFile ? mount.readText(fullPath) : mount.readBytes(fullPath);
};
