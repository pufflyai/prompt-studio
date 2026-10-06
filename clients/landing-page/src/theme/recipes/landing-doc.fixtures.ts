import type { LandingDocument, LandingPage } from "../../content/landing-pages";

const banner = new URL("../../../../../design/art/blog-welcome-to-prompt-studio.png", import.meta.url).href;
const lightBanner = new URL("../../../../../design/art/blog-welcome-to-prompt-studio-light.png", import.meta.url).href;
const olderBanner = new URL("../../../../../design/art/blog-malleable-software.png", import.meta.url).href;
const olderLightBanner = new URL("../../../../../design/art/blog-malleable-software-light.png", import.meta.url).href;
const toolBanner = new URL("../../../../../design/art/blog-shape-art.png", import.meta.url).href;
const toolLightBanner = new URL("../../../../../design/art/blog-shape-art-light.png", import.meta.url).href;

// Sample pages and markup only. Real docs come from the repo's markdown.
const doc = (path: string, label: string): LandingPage => ({
  path,
  view: "doc",
  label,
  title: `${label} | Prompt Studio docs`,
  description: `A sample description for ${label}.`,
});

export const STORY_DOCS_HOME: LandingPage = {
  path: "/docs/",
  view: "docs",
  label: "Docs home",
  title: "Docs | Prompt Studio",
  description: "Guides and references for Prompt Studio.",
};

export const STORY_BLOG_HOME: LandingPage = {
  path: "/blog/",
  view: "blog",
  label: "All posts",
  title: "Blog | Prompt Studio",
  description: "Releases, thoughts, and tool showcases from the people who build Prompt Studio.",
};

export const STORY_SESSIONS = doc("/docs/references/cli/sessions/", "Sessions");

export const STORY_POST: Extract<LandingPage, { view: "post" }> = {
  path: "/blog/sample-post/",
  view: "post",
  label: "A sample post title",
  title: "A sample post title | Prompt Studio blog",
  description: "One sentence that says what the post is about.",
  published: "2026-08-31",
  category: "thoughts",
  author: BLOG_AUTHORS["aurelien-franky"],
  readingMinutes: 3,
  image: {
    light: { src: lightBanner, width: 1600, height: 400 },
    dark: { src: banner, width: 1600, height: 400 },
  },
};

export const STORY_PAGES: LandingPage[] = [
  STORY_DOCS_HOME,
  STORY_BLOG_HOME,
  doc("/docs/guides/getting-started/install/", "Install Prompt Studio"),
  doc("/docs/guides/getting-started/open-a-project/", "Open a project"),
  doc("/docs/references/cli/overview/", "Overview"),
  doc("/docs/references/cli/workspaces/", "Workspaces"),
  STORY_SESSIONS,
  doc("/docs/references/cli/automation/", "Remote automation"),
  doc("/docs/references/workbench/overview/", "Overview"),
  doc("/docs/extensions/planner/", "Overview"),
  doc("/docs/extensions/planner/cli/", "CLI"),
  STORY_POST,
  {
    ...STORY_POST,
    path: "/blog/older-post/",
    label: "An older post",
    published: "2026-08-01",
    category: "release",
    description: "Posts are listed newest first.",
    image: {
      light: { src: olderLightBanner, width: 1600, height: 400 },
      dark: { src: olderBanner, width: 1600, height: 400 },
    },
  },
  {
    ...STORY_POST,
    path: "/blog/tool-showcase/",
    label: "Shape art: make blog banners",
    published: "2026-10-06T08:00:00Z",
    category: "tool showcase",
    description: "A live editor for people and saved recipes agents can use from the CLI.",
    image: {
      light: { src: toolLightBanner, width: 1600, height: 400 },
      dark: { src: toolBanner, width: 1600, height: 400 },
    },
  },
];

// Matches Shiki's `css-variables` theme output.
const code = (token: string, text: string) => `<span style="color: var(--astro-code-token-${token})">${text}</span>`;

export const STORY_DOCUMENT: LandingDocument = {
  headings: [
    { depth: 1, slug: "sessions", text: "Sessions" },
    { depth: 2, slug: "commands", text: "Commands" },
    { depth: 2, slug: "options", text: "Options" },
    { depth: 2, slug: "examples", text: "Examples" },
  ],
  html: `
<h1 id="sessions">Sessions</h1>
<p>A sample introduction paragraph. It becomes the page description.</p>
<h2 id="commands">Commands</h2>
<p>Run a command with <code>pst sessions</code>. A <a href="/docs/references/cli/workspaces/">link to another page</a> opens without a reload.</p>
<pre class="astro-code css-variables" style="background-color: var(--astro-code-background); color: var(--astro-code-foreground)" tabindex="0"><code><span class="line">${code("function", "pst")}${code("string", " sessions create")}${code("constant", " --prompt")}${code("comment", " # a comment")}</span></code></pre>
<h2 id="options">Options</h2>
<table>
<thead><tr><th>Option</th><th>Meaning</th></tr></thead>
<tbody>
<tr><td><code>--workspace</code></td><td>Run in this workspace.</td></tr>
<tr><td><code>--agent</code></td><td>Use this agent.</td></tr>
<tr><td><code>--json</code></td><td>Print machine-readable output.</td></tr>
</tbody>
</table>
<h2 id="examples">Examples</h2>
<ol><li>An ordered step.</li><li>Another step.</li></ol>
<blockquote><p>A short note.</p></blockquote>
`,
};

export const STORY_POST_DOCUMENT: LandingDocument = {
  headings: [{ depth: 2, slug: "a-section", text: "A section" }],
  html: `
<p>The opening paragraph of a sample post.</p>
<h2 id="a-section">A section</h2>
<p>A paragraph with a <a href="/docs/">link to the docs</a>.</p>
<ul><li>A point</li><li>Another point</li></ul>
`,
};

export const STORY_POST_OUTLINE_DOCUMENT: LandingDocument = {
  headings: [
    { depth: 2, slug: "shared-foundations", text: "Shared foundations" },
    { depth: 2, slug: "tools-for-your-work", text: "Tools for your work" },
    { depth: 2, slug: "where-to-start", text: "Where to start" },
  ],
  html: `
<p>A post with several sections uses the same outline as documentation.</p>
<h2 id="shared-foundations">Shared foundations</h2>
${"<p>Tools share storage, a workbench, and public commands. People and agents can use the same operations.</p>".repeat(8)}
<h2 id="tools-for-your-work">Tools for your work</h2>
${"<p>Build one small tool, try it, and keep changing it as your work changes.</p>".repeat(8)}
<h2 id="where-to-start">Where to start</h2>
<p>Open a project and ask an agent for a useful tool.</p>
`,
};

import { BLOG_AUTHORS } from "../../content/blog-authors";
