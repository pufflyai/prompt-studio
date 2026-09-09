import { siteMetadata } from "../config/site-metadata";

export const GET = () =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${siteMetadata.siteUrl}/sitemap.xml\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
