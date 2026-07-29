import {
  type ArtifactMount,
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
  internalCommand: string,
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
  title: "Inspect font",
  async run(ctx) {
    return inspectRepositoryFont(requireRepoFiles(ctx));
  },
});

const previewInternal = defineCommand({
  title: "Load font preview",
  async run(ctx) {
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
  title: "Add SVG glyph",
  params: addParams,
  async run(ctx) {
    return addRepositoryGlyph(requireRepoFiles(ctx), {
      name: ctx.params.name,
      svg: await readSvg(ctx, ctx.params),
      codepoint: ctx.params.codepoint,
    });
  },
});

const renameInternal = defineCommand({
  title: "Rename glyph",
  params: {
    ...glyphParams,
    name: params.text({ required: true, label: "New name" }),
  },
  async run(ctx) {
    return renameRepositoryGlyph(requireRepoFiles(ctx), ctx.params.glyph, ctx.params.name);
  },
});

const codepointInternal = defineCommand({
  title: "Set glyph codepoint",
  params: {
    ...glyphParams,
    codepoint: params.text({ required: true, label: "Codepoint" }),
  },
  async run(ctx) {
    return setRepositoryGlyphCodepoint(requireRepoFiles(ctx), ctx.params.glyph, ctx.params.codepoint);
  },
});

const removeInternal = defineCommand({
  title: "Remove glyph",
  params: glyphParams,
  async run(ctx) {
    return removeRepositoryGlyph(requireRepoFiles(ctx), ctx.params.glyph);
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
  title: "Get font editor configuration",
  async run(ctx) {
    return readRepositoryConfig(requireRepoFiles(ctx));
  },
});

const configSetInternal = defineCommand({
  title: "Set font editor configuration",
  params: configPatchParams,
  async run(ctx) {
    return updateRepositoryConfig(requireRepoFiles(ctx), definedValues(ctx.params));
  },
});

const buildInternal = defineCommand({
  title: "Build font",
  async run(ctx) {
    return buildRepositoryFont(requireRepoFiles(ctx));
  },
});

const verifyInternal = defineCommand({
  title: "Verify font",
  async run(ctx) {
    return verifyRepositoryFont(requireRepoFiles(ctx));
  },
});

export const fontCommands = {
  inspect: defineCommand({
    title: "Inspect font",
    description: "List font metadata and glyph mappings.",
    cli: true,
    async run(ctx) {
      return inRepository(ctx, "font-editor.internal.inspect", {}, inspectRepositoryFont);
    },
  }),
  preview: defineCommand({
    title: "Load font preview",
    description: "Return the canonical TTF as a browser-safe data URL.",
    cli: true,
    async run(ctx) {
      return inRepository(ctx, "font-editor.internal.preview", {}, previewRepositoryFont);
    },
  }),
  "glyph.add": defineCommand({
    title: "Add SVG glyph",
    description: "Add one SVG path to the icon font and regenerate every output.",
    cli: true,
    params: addParams,
    async run(ctx) {
      if (ctx.repoFiles) {
        return addRepositoryGlyph(ctx.repoFiles, {
          name: ctx.params.name,
          svg: await readSvg(ctx, ctx.params),
          codepoint: ctx.params.codepoint,
        });
      }
      return inRepository(ctx, "font-editor.internal.glyph.add", definedValues(ctx.params), async () => {
        throw new Error("Unreachable");
      });
    },
  }),
  "glyph.rename": defineCommand({
    title: "Rename glyph",
    description: "Rename a glyph without changing its contours.",
    cli: true,
    params: renameInternal.params,
    async run(ctx) {
      const values = { glyph: ctx.params.glyph, name: ctx.params.name };
      return inRepository(ctx, "font-editor.internal.glyph.rename", values, (mount) =>
        renameRepositoryGlyph(mount, values.glyph, values.name),
      );
    },
  }),
  "glyph.codepoint": defineCommand({
    title: "Set glyph codepoint",
    description: "Move a glyph to an unused Unicode codepoint.",
    cli: true,
    params: codepointInternal.params,
    async run(ctx) {
      const values = { glyph: ctx.params.glyph, codepoint: ctx.params.codepoint };
      return inRepository(ctx, "font-editor.internal.glyph.codepoint", values, (mount) =>
        setRepositoryGlyphCodepoint(mount, values.glyph, values.codepoint),
      );
    },
  }),
  "glyph.remove": defineCommand({
    title: "Remove glyph",
    description: "Remove a glyph and regenerate every output.",
    cli: true,
    params: glyphParams,
    async run(ctx) {
      const values = { glyph: ctx.params.glyph };
      return inRepository(ctx, "font-editor.internal.glyph.remove", values, (mount) =>
        removeRepositoryGlyph(mount, values.glyph),
      );
    },
  }),
  "config.get": defineCommand({
    title: "Get font editor configuration",
    cli: true,
    async run(ctx) {
      return inRepository(ctx, "font-editor.internal.config.get", {}, readRepositoryConfig);
    },
  }),
  "config.set": defineCommand({
    title: "Set font editor configuration",
    description: "Update settings and rebuild verified outputs.",
    cli: true,
    params: configPatchParams,
    async run(ctx) {
      const values = definedValues(ctx.params);
      return inRepository(ctx, "font-editor.internal.config.set", values, (mount) =>
        updateRepositoryConfig(mount, values),
      );
    },
  }),
  build: defineCommand({
    title: "Build font",
    description: "Regenerate and verify every font and CSS output.",
    cli: true,
    async run(ctx) {
      return inRepository(ctx, "font-editor.internal.build", {}, buildRepositoryFont);
    },
  }),
  verify: defineCommand({
    title: "Verify font",
    description: "Verify generated formats and CSS against the canonical TTF.",
    cli: true,
    async run(ctx) {
      return inRepository(ctx, "font-editor.internal.verify", {}, verifyRepositoryFont);
    },
  }),
  "internal.inspect": inspectInternal,
  "internal.preview": previewInternal,
  "internal.glyph.add": addInternal,
  "internal.glyph.rename": renameInternal,
  "internal.glyph.codepoint": codepointInternal,
  "internal.glyph.remove": removeInternal,
  "internal.config.get": configGetInternal,
  "internal.config.set": configSetInternal,
  "internal.build": buildInternal,
  "internal.verify": verifyInternal,
};
