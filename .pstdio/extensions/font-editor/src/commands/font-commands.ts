import {
  type ArtifactMount,
  type CommandRef,
  defineCommand,
  type ExtensionContextBase,
  type JsonObject,
  params,
  unwrapCommandOutcome,
} from "@pstdio/sdk/extensions";
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

const requireRepoFiles = (ctx: ExtensionContextBase) => {
  if (!ctx.repoFiles) throw new Error("Font editor commands require a repository.");
  return ctx.repoFiles;
};

const inRepository = async <TResult>(
  ctx: ExtensionContextBase,
  internalCommand: CommandRef<JsonObject, TResult>,
  commandParams: JsonObject,
  local: (mount: ArtifactMount) => Promise<TResult>,
) => {
  if (ctx.repoFiles) return local(ctx.repoFiles);
  const repo = await ctx.repos.getDefault();
  if (!repo) throw new Error("The project does not have a default repository.");
  const outcome = await ctx.commands.execute<JsonObject, TResult>(internalCommand, {
    params: commandParams,
    repoId: repo.repoId,
    repoPath: repo.path,
  });
  return unwrapCommandOutcome({ outcome });
};

const inspectInternal = defineCommand({
  id: "internal.inspect",
  title: "Inspect font",
  async run(ctx, _commandParams) {
    return inspectRepositoryFont(requireRepoFiles(ctx));
  },
});

const previewInternal = defineCommand({
  id: "internal.preview",
  title: "Load font preview",
  async run(ctx, _commandParams) {
    return previewRepositoryFont(requireRepoFiles(ctx));
  },
});

const glyphParams = {
  glyph: params.text({ required: true, label: "Glyph name or codepoint" }),
};

const addParams = {
  name: params.text({ required: true, label: "Glyph name" }),
  svg: params.longText({ label: "Inline SVG markup" }),
  svgPath: params.text({ label: "Repository-relative SVG path" }),
  fileId: params.text({ label: "Uploaded SVG file id" }),
  codepoint: params.text({ label: "Codepoint" }),
};

const readSvg = async (ctx: ExtensionContextBase, input: { svg?: string; svgPath?: string; fileId?: string }) => {
  if (input.svg) return input.svg;
  if (input.fileId) return ctx.files.readText(input.fileId);
  if (input.svgPath) return requireRepoFiles(ctx).readText(input.svgPath);
  throw new Error("Provide svg, svgPath, or fileId.");
};

const addInternal = defineCommand({
  id: "internal.glyph.add",
  title: "Add SVG glyph",
  params: addParams,
  async run(ctx, commandParams) {
    return addRepositoryGlyph(requireRepoFiles(ctx), {
      name: commandParams.name,
      svg: await readSvg(ctx, commandParams),
      codepoint: commandParams.codepoint,
    });
  },
});

const renameInternal = defineCommand({
  id: "internal.glyph.rename",
  title: "Rename glyph",
  params: {
    ...glyphParams,
    name: params.text({ required: true, label: "New name" }),
  },
  async run(ctx, commandParams) {
    return renameRepositoryGlyph(requireRepoFiles(ctx), commandParams.glyph, commandParams.name);
  },
});

const codepointInternal = defineCommand({
  id: "internal.glyph.codepoint",
  title: "Set glyph codepoint",
  params: {
    ...glyphParams,
    codepoint: params.text({ required: true, label: "Codepoint" }),
  },
  async run(ctx, commandParams) {
    return setRepositoryGlyphCodepoint(requireRepoFiles(ctx), commandParams.glyph, commandParams.codepoint);
  },
});

const removeInternal = defineCommand({
  id: "internal.glyph.remove",
  title: "Remove glyph",
  params: glyphParams,
  async run(ctx, commandParams) {
    return removeRepositoryGlyph(requireRepoFiles(ctx), commandParams.glyph);
  },
});

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

const configGetInternal = defineCommand({
  id: "internal.config.get",
  title: "Get font editor configuration",
  async run(ctx, _commandParams) {
    return readRepositoryConfig(requireRepoFiles(ctx));
  },
});

const configSetInternal = defineCommand({
  id: "internal.config.set",
  title: "Set font editor configuration",
  params: configPatchParams,
  async run(ctx, commandParams) {
    return updateRepositoryConfig(requireRepoFiles(ctx), definedValues(commandParams));
  },
});

const buildInternal = defineCommand({
  id: "internal.build",
  title: "Build font",
  async run(ctx, _commandParams) {
    return buildRepositoryFont(requireRepoFiles(ctx));
  },
});

const verifyInternal = defineCommand({
  id: "internal.verify",
  title: "Verify font",
  async run(ctx, _commandParams) {
    return verifyRepositoryFont(requireRepoFiles(ctx));
  },
});

export const fontEditorCommands = {
  inspect: defineCommand({
    id: "inspect",
    title: "Inspect font",
    description: "List font metadata and glyph mappings.",
    cli: true,
    async run(ctx, _commandParams) {
      return inRepository(ctx, inspectInternal.ref, {}, inspectRepositoryFont);
    },
  }),
  preview: defineCommand({
    id: "preview",
    title: "Load font preview",
    description: "Return the canonical TTF as a browser-safe data URL.",
    cli: true,
    async run(ctx, _commandParams) {
      return inRepository(ctx, previewInternal.ref, {}, previewRepositoryFont);
    },
  }),
  "glyph.add": defineCommand({
    id: "glyph.add",
    title: "Add SVG glyph",
    description: "Add one SVG path to the icon font and regenerate every output.",
    cli: true,
    params: addParams,
    async run(ctx, commandParams) {
      if (ctx.repoFiles) {
        return addRepositoryGlyph(ctx.repoFiles, {
          name: commandParams.name,
          svg: await readSvg(ctx, commandParams),
          codepoint: commandParams.codepoint,
        });
      }
      return inRepository(ctx, addInternal.ref, definedValues(commandParams), async () => {
        throw new Error("Unreachable");
      });
    },
  }),
  "glyph.rename": defineCommand({
    id: "glyph.rename",
    title: "Rename glyph",
    description: "Rename a glyph without changing its contours.",
    cli: true,
    params: renameInternal.params,
    async run(ctx, commandParams) {
      const values = { glyph: commandParams.glyph, name: commandParams.name };
      return inRepository(ctx, renameInternal.ref, values, (mount) =>
        renameRepositoryGlyph(mount, values.glyph, values.name),
      );
    },
  }),
  "glyph.codepoint": defineCommand({
    id: "glyph.codepoint",
    title: "Set glyph codepoint",
    description: "Move a glyph to an unused Unicode codepoint.",
    cli: true,
    params: codepointInternal.params,
    async run(ctx, commandParams) {
      const values = { glyph: commandParams.glyph, codepoint: commandParams.codepoint };
      return inRepository(ctx, codepointInternal.ref, values, (mount) =>
        setRepositoryGlyphCodepoint(mount, values.glyph, values.codepoint),
      );
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
      return inRepository(ctx, removeInternal.ref, values, (mount) => removeRepositoryGlyph(mount, values.glyph));
    },
  }),
  "config.get": defineCommand({
    id: "config.get",
    title: "Get font editor configuration",
    cli: true,
    async run(ctx, _commandParams) {
      return inRepository(ctx, configGetInternal.ref, {}, readRepositoryConfig);
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
      return inRepository(ctx, configSetInternal.ref, values, (mount) => updateRepositoryConfig(mount, values));
    },
  }),
  build: defineCommand({
    id: "build",
    title: "Build font",
    description: "Regenerate and verify every font and CSS output.",
    cli: true,
    async run(ctx, _commandParams) {
      return inRepository(ctx, buildInternal.ref, {}, buildRepositoryFont);
    },
  }),
  verify: defineCommand({
    id: "verify",
    title: "Verify font",
    description: "Verify generated formats and CSS against the canonical TTF.",
    cli: true,
    async run(ctx, _commandParams) {
      return inRepository(ctx, verifyInternal.ref, {}, verifyRepositoryFont);
    },
  }),
};

export const fontCommands = [
  ...Object.values(fontEditorCommands),
  inspectInternal,
  previewInternal,
  addInternal,
  renameInternal,
  codepointInternal,
  removeInternal,
  configGetInternal,
  configSetInternal,
  buildInternal,
  verifyInternal,
];
