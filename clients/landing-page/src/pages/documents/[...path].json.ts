import type { APIRoute, GetStaticPaths } from "astro";
import { loadSiteCatalog } from "../../services/site-catalog";

// One JSON file per document, so in-site navigation fetches only the page it opens.
export const getStaticPaths = (async () => {
  const { documents } = await loadSiteCatalog();
  return [...documents].map(([path, document]) => ({ params: { path: path.slice(1, -1) }, props: { document } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => Response.json(props.document);
