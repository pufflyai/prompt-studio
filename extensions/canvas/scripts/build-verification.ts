import { mkdir, rm, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { verificationRoot } from "./verification-paths";

// The page outside the frame is UI Canvas itself; the frames load the project's build.
export const buildVerification = async () => {
  const root = verificationRoot;
  const pages = resolve(root, "pages");
  await mkdir(pages, { recursive: true });
  await writeFile(
    resolve(pages, "canvas.html"),
    `<!doctype html><html><head><meta charset="utf-8"><title>UI Canvas verification</title><style>html,body,#root{margin:0;width:100%;height:100%}</style></head><body><div id="root"></div><script type="module" src="${relative(pages, resolve(import.meta.dir, "native-verification-entry.tsx"))}"></script></body></html>`,
  );
  await writeFile(
    resolve(pages, "index.html"),
    '<!doctype html><html><head><meta charset="utf-8"><style>html,body,iframe{margin:0;width:100%;height:100%;border:0}</style></head><body><iframe data-verification-host title="UI Canvas" sandbox="allow-scripts allow-forms"></iframe><script>document.querySelector("iframe").src="/canvas.html"+location.search</script></body></html>',
  );
  const outdir = resolve(root, "dist");
  await rm(outdir, { recursive: true, force: true });
  const result = await Bun.build({
    entrypoints: [resolve(pages, "index.html"), resolve(pages, "canvas.html")],
    outdir,
    target: "browser",
    minify: true,
    define: { "process.env.NODE_ENV": '"production"' },
    throw: false,
  });
  if (!result.success) throw new AggregateError(result.logs, "The verification page could not be built");
  return outdir;
};
if (import.meta.main) console.log(await buildVerification());
