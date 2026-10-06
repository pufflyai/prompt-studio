import { getImage } from "astro:assets";
import { type CollectionEntry, getCollection, render } from "astro:content";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { BLOG_AUTHORS } from "../content/blog-authors";
import { DOCS_TOPICS, docsTopicForPath, publishedDocPath } from "../content/docs-topics";
import { LANDING_PAGES, type LandingDocument, type LandingPage } from "../content/landing-pages";

type MarkdownEntry = CollectionEntry<"docs" | "blog" | "legal">;

// What the markdown plugins in `services/markdown` add to Astro's render metadata.
interface MarkdownMetadata {
  headings?: LandingDocument["headings"];
  frontmatter?: { description?: string; brokenLinks?: string[]; readingMinutes?: number };
}

const metadataOf = (entry: MarkdownEntry) => (entry.rendered?.metadata ?? {}) as MarkdownMetadata;

const documentOf = async (entry: MarkdownEntry, container: AstroContainer) => {
  // Astro's content renderer resolves local images into built assets before HTML is serialized.
  const { Content, headings } = await render(entry);
  return { html: await container.renderToString(Content), headings };
};

const docPage = (entry: CollectionEntry<"docs">): LandingPage => {
  const path = publishedDocPath(entry.id)!;
  const topic = docsTopicForPath(path)!;
  const { headings, frontmatter } = metadataOf(entry);
  const heading = headings?.find((item) => item.depth === 1)?.text;
  const description = frontmatter?.description;
  if (!heading) throw new Error(`${entry.id} needs a "# " title.`);
  if (!description) throw new Error(`${entry.id} needs a paragraph right after its title. It is the page description.`);
  const name = heading === topic.label ? heading : `${heading} · ${topic.label}`;
  return {
    path,
    view: "doc",
    label: entry.id === topic.overview ? "Overview" : heading,
    title: `${name} | Prompt Studio docs`,
    description,
  };
};

const postPage = async (entry: CollectionEntry<"blog">) => {
  const readingMinutes = metadataOf(entry).frontmatter?.readingMinutes;
  if (readingMinutes === undefined) throw new Error(`${entry.id} is missing its calculated reading time.`);
  const [light, dark] = await Promise.all(
    [entry.data.image.light, entry.data.image.dark].map(async (source) => {
      const image = await getImage({ src: source, width: 1280, format: "webp" });
      return { src: image.src, width: Number(image.attributes.width), height: Number(image.attributes.height) };
    }),
  );
  return {
    path: `/blog/${entry.id}/`,
    view: "post",
    label: entry.data.title,
    title: `${entry.data.title} | Prompt Studio blog`,
    description: entry.data.description,
    published: entry.data.published.toISOString(),
    category: entry.data.category,
    author: BLOG_AUTHORS[entry.data.author],
    readingMinutes,
    image: { light, dark },
  } satisfies LandingPage;
};

// Docs order: topics in allow-list order, the overview first, then file numbers.
const docOrder = (entry: CollectionEntry<"docs">) => {
  const topicIndex = DOCS_TOPICS.indexOf(docsTopicForPath(publishedDocPath(entry.id)!)!);
  return `${String(topicIndex).padStart(3, "0")}/${entry.id.endsWith("/README.md") ? "" : entry.id}`;
};

/**
 * Every page the site serves, in navigation order, and the HTML of the pages that
 * read as documents. Build time only. A broken relative link, a docs page without
 * a title or description, or a legal page without its markdown fails the build.
 */
export const loadSiteCatalog = async () => {
  const [docs, posts, legal] = await Promise.all([
    getCollection("docs"),
    getCollection("blog"),
    getCollection("legal"),
  ]);

  const broken = [...docs, ...posts, ...legal].flatMap((entry) =>
    (metadataOf(entry).frontmatter?.brokenLinks ?? []).map(
      (link) => `${entry.filePath ?? entry.id} links to "${link}", which does not exist.`,
    ),
  );
  if (broken.length > 0) throw new Error(`Broken links in published markdown:\n${broken.join("\n")}`);

  const sortedDocs = [...docs].sort((a, b) => docOrder(a).localeCompare(docOrder(b)));
  const sortedPosts = [...posts].sort((a, b) => b.data.published.getTime() - a.data.published.getTime());
  const pages = [...LANDING_PAGES, ...sortedDocs.map(docPage), ...(await Promise.all(sortedPosts.map(postPage)))];

  const container = await AstroContainer.create();
  const documents = new Map<string, LandingDocument>();
  for (const page of pages.filter((item) => item.view === "legal")) {
    const entry = legal.find((item) => `/${item.id}/` === page.path);
    if (!entry) throw new Error(`Missing legal markdown in src/content/legal: ${page.path.slice(1, -1)}.md`);
    documents.set(page.path, await documentOf(entry, container));
  }
  for (const entry of sortedDocs) documents.set(publishedDocPath(entry.id)!, await documentOf(entry, container));
  for (const entry of sortedPosts) documents.set(`/blog/${entry.id}/`, await documentOf(entry, container));

  const paths = pages.map((page) => page.path);
  const duplicate = paths.find((path, index) => paths.indexOf(path) !== index);
  if (duplicate) throw new Error(`Two pages share the path ${duplicate}. Rename one of their files.`);

  return { pages, documents };
};
