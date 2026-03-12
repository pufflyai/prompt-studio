export const shouldLoadEmbedManifest = (env = process.env) => env.PSTDIO_DISABLE_EMBED_MANIFEST !== "1";
