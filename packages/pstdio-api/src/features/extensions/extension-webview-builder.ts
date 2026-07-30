export type ExtensionWebviewBuildInput = {
  entryPath: string;
  outdir: string;
  signal: AbortSignal;
};

export type ExtensionWebviewBuildResult = {
  details: string;
  success: boolean;
};

export type ExtensionWebviewBuilder = (input: ExtensionWebviewBuildInput) => Promise<ExtensionWebviewBuildResult>;

export const buildExtensionWebview: ExtensionWebviewBuilder = async (input) => {
  if (input.signal.aborted) return { success: false, details: "Build aborted." };

  try {
    const result = await Bun.build({
      entrypoints: [input.entryPath],
      outdir: input.outdir,
      target: "browser",
      format: "esm",
      naming: {
        entry: "module.[ext]",
        asset: "[name]-[hash].[ext]",
      },
    });

    if (input.signal.aborted) return { success: false, details: "Build aborted." };
    return {
      success: result.success,
      details: result.success ? "" : result.logs.map(String).join("\n") || "Webview build failed.",
    };
  } catch (error) {
    return { success: false, details: error instanceof Error ? error.message : String(error) };
  }
};
