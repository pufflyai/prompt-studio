import { defineCommand, type ExtensionContextBase, params } from "@pstdio/sdk/extensions";
import {
  addRepositoryGlyph,
  buildRepositoryFont,
  inspectRepositoryFont,
  previewRepositoryFont,
  readRepositoryConfig,
  removeRepositoryGlyph,
  renameRepositoryGlyph,
  setRepositoryGlyphCodepoint,
  updateRepositoryConfig,
  verifyRepositoryFont,
} from "../repository/font-repository";

const requireProjectFiles = (ctx: ExtensionContextBase) => {
  if (!ctx.projectFiles) throw new Error("Font editor commands require project files.");
  return ctx.projectFiles;
};

const glyphParams = {
  glyph: params.text({ required: true, label: "Glyph name or codepoint" }),
};

const addParams = {
  name: params.text({ required: true, label: "Glyph name" }),
  svg: params.longText({ label: "Inline SVG markup" }),
  svgPath: params.text({ label: "Project-relative SVG path" }),
  fileId: params.text({ label: "Uploaded SVG file id" }),
  codepoint: params.text({ label: "Codepoint" }),
};

const readSvg = async (ctx: ExtensionContextBase, input: { svg?: string; svgPath?: string; fileId?: string }) => {
  if (input.svg) return input.svg;
  if (input.fileId) return ctx.files.readText(input.fileId);
  if (input.svgPath) return requireProjectFiles(ctx).readText(input.svgPath);
  throw new Error("Provide svg, svgPath, or fileId.");
};

const configPatchParams = {
  family: params.text({ label: "Font family" }),
  fileName: params.text({ label: "Output file name" }),
  cssPrefix: params.text({ label: "CSS class prefix" }),
  fontsUrl: params.text({ label: "CSS fonts URL" }),
  outputDir: params.text({ label: "Output directory" }),
  cssFile: params.text({ label: "CSS file path" }),
  startCodepoint: params.text({ label: "First assignable codepoint" }),
  endCodepoint: params.text({ label: "Last assignable codepoint" }),
};

const definedValues = (value: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => entry[1] !== undefined));

export const fontEditorCommands = {
  inspect: defineCommand({
    id: "inspect",
    title: "Inspect font",
    description: "List font metadata and glyph mappings.",
    cli: true,
    async run(ctx, _commandParams) {
      return inspectRepositoryFont(requireProjectFiles(ctx));
    },
  }),
  preview: defineCommand({
    id: "preview",
    title: "Load font preview",
    description: "Return the canonical TTF as a browser-safe data URL.",
    cli: true,
    async run(ctx, _commandParams) {
      return previewRepositoryFont(requireProjectFiles(ctx));
    },
  }),
  "glyph.add": defineCommand({
    id: "glyph.add",
    title: "Add SVG glyph",
    description: "Add one SVG path to the icon font and regenerate every output.",
    cli: true,
    params: addParams,
    async run(ctx, commandParams) {
      return addRepositoryGlyph(requireProjectFiles(ctx), {
        name: commandParams.name,
        svg: await readSvg(ctx, commandParams),
        codepoint: commandParams.codepoint,
      });
    },
  }),
  "glyph.rename": defineCommand({
    id: "glyph.rename",
    title: "Rename glyph",
    description: "Rename a glyph without changing its contours.",
    cli: true,
    params: { ...glyphParams, name: params.text({ required: true, label: "New name" }) },
    async run(ctx, commandParams) {
      const values = { glyph: commandParams.glyph, name: commandParams.name };
      return renameRepositoryGlyph(requireProjectFiles(ctx), values.glyph, values.name);
    },
  }),
  "glyph.codepoint": defineCommand({
    id: "glyph.codepoint",
    title: "Set glyph codepoint",
    description: "Move a glyph to an unused Unicode codepoint.",
    cli: true,
    params: { ...glyphParams, codepoint: params.text({ required: true, label: "Codepoint" }) },
    async run(ctx, commandParams) {
      const values = { glyph: commandParams.glyph, codepoint: commandParams.codepoint };
      return setRepositoryGlyphCodepoint(requireProjectFiles(ctx), values.glyph, values.codepoint);
    },
  }),
  "glyph.remove": defineCommand({
    id: "glyph.remove",
    title: "Remove glyph",
    description: "Remove a glyph and regenerate every output.",
    cli: true,
    params: glyphParams,
    async run(ctx, commandParams) {
      const values = { glyph: commandParams.glyph };
      return removeRepositoryGlyph(requireProjectFiles(ctx), values.glyph);
    },
  }),
  "config.get": defineCommand({
    id: "config.get",
    title: "Get font editor configuration",
    cli: true,
    async run(ctx, _commandParams) {
      return readRepositoryConfig(requireProjectFiles(ctx));
    },
  }),
  "config.set": defineCommand({
    id: "config.set",
    title: "Set font editor configuration",
    description: "Update settings and rebuild verified outputs.",
    cli: true,
    params: configPatchParams,
    async run(ctx, commandParams) {
      const values = definedValues(commandParams);
      return updateRepositoryConfig(requireProjectFiles(ctx), values);
    },
  }),
  build: defineCommand({
    id: "build",
    title: "Build font",
    description: "Regenerate and verify every font and CSS output.",
    cli: true,
    async run(ctx, _commandParams) {
      return buildRepositoryFont(requireProjectFiles(ctx));
    },
  }),
  verify: defineCommand({
    id: "verify",
    title: "Verify font",
    description: "Verify generated formats and CSS against the canonical TTF.",
    cli: true,
    async run(ctx, _commandParams) {
      return verifyRepositoryFont(requireProjectFiles(ctx));
    },
  }),
};

export const fontCommands = Object.values(fontEditorCommands);
