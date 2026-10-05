import { siteMetadata } from "../config/site-metadata";
import { loadSiteCatalog } from "../services/site-catalog";

export const GET = async () => {
  const { pages } = await loadSiteCatalog();
  const urls = pages.map((page) => `<url><loc>${new URL(page.path, siteMetadata.siteUrl).href}</loc></url>`);
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
};
