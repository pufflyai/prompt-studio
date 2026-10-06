import { existsSync, statSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { MdastPluginDefinition as MdastPlugin } from "satteri";
import { siteMetadata } from "../../config/site-metadata";
import { publishedDocPath } from "../../content/docs-topics";

type VisitorContext = Parameters<NonNullable<MdastPlugin["link"]>>[1];

const ABSOLUTE = /^([a-z][a-z0-9+.-]*:|\/|#)/i;

/**
 * Lets one markdown file work on GitHub and on the site. A relative link to a
 * published page becomes its site path, and a link to any other repo file becomes
 * a GitHub link. A link to a missing file is recorded in the frontmatter as
 * `brokenLinks`, so the page catalog can fail the build with every broken link.
 */
export const publishedLinks = (repoRoot: string): MdastPlugin => {
  const siteUrl = (url: string, ctx: VisitorContext) => {
    if (!ctx.fileURL || ABSOLUTE.test(url)) return undefined;
    const [target, hash] = url.split("#", 2);
    const file = resolve(dirname(fileURLToPath(ctx.fileURL)), decodeURIComponent(target));
    const repoFile = relative(repoRoot, file).split(sep).join("/");
    if (repoFile.startsWith("../") || !existsSync(file)) {
      const frontmatter = ctx.data.astro?.frontmatter;
      if (frontmatter) frontmatter.brokenLinks = [...(frontmatter.brokenLinks ?? []), url];
      return undefined;
    }
    const fragment = hash === undefined ? "" : `#${hash}`;
    const githubKind = statSync(file).isDirectory() ? "tree" : "blob";
    const path = publishedDocPath(repoFile) ?? `${siteMetadata.repositoryUrl}/${githubKind}/main/${repoFile}`;
    return `${path}${fragment}`;
  };

  return {
    name: "published-links",
    link(node, ctx) {
      const url = siteUrl(node.url, ctx);
      if (url) ctx.setProperty(node, "url", url);
    },
    definition(node, ctx) {
      const url = siteUrl(node.url, ctx);
      if (url) ctx.setProperty(node, "url", url);
    },
  };
};
