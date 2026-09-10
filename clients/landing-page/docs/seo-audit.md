# Landing page SEO audit

Audited on September 9, 2026, against the landing-page branch and its isolated
production build. This covers source HTML, rendered pages, navigation, metadata,
HTTP responses, and mobile layout. It does not measure production rankings,
Search Console indexing, or real-user Core Web Vitals.

| Finding | Result |
| --- | --- |
| Every page had the same title and description. | Each canonical page now has its own title, description, canonical link, Open Graph tags, and Twitter tags. These are present in the initial HTML and update during navigation and browser history. |
| Example tabs only changed React state. | All four examples now have descriptive URLs, their own prerendered content, and a heading that names the tool. |
| Sidebar entries and example tabs were buttons without destinations. | They now render as links with real `href` values. Example navigation also works with JavaScript disabled. Modified clicks retain normal browser behavior. |
| No sitemap or robots.txt existed. | Both now return HTTP 200. The sitemap lists nine canonical pages. robots.txt points to the sitemap and allows crawling. |
| The persistent introduction repeated the main heading on content pages. | It uses an H1 on Start Here and an H2 elsewhere. Each product page has one H1 in its initial HTML. |
| Every page described itself as a SoftwareApplication, including legal pages. | Structured data now identifies the website and the current web page. It does not claim that an example is a separate downloadable application. |
| The generated error page had no indexing directive. | `/404.html` now has `noindex` and no canonical link. An unknown path returns HTTP 404 from the isolated nginx server. |
| The introduction preceded the content on mobile. | The full introduction/download panel now follows the content before and after hydration. Navigation from its footer returns the next page to the top. |

The route catalog in `src/content/landing-pages.ts` supplies static routes, page
metadata, example selection, navigation destinations, and the sitemap. This keeps
the visible tab and the document metadata tied to the same URL.

| Example | Canonical path |
| --- | --- |
| Coding agent dashboard | `/examples/coding-agent-dashboard/` |
| Icon set editor | `/examples/icon-set-editor/` |
| Shader editor | `/examples/shader-editor/` |
| Financial formulas | `/examples/financial-formulas/` |

`/examples/` remains an entry to the coding agent example. Its canonical points to
`/examples/coding-agent-dashboard/`, and it is excluded from the sitemap to avoid
listing duplicate content. Canonical URLs use trailing slashes, matching the static
server's directory URLs.

Google recommends crawlable anchor links, descriptive page metadata, and rendered
HTML that contains the page content. See its [JavaScript SEO guide](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).
The sitemap follows Google's [canonical URL and sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

Follow-up work:

- Render the legal document bodies into the initial HTML. The current rich-text
  renderer fills them after JavaScript starts. Their metadata and URLs are present
  in the source response, but their legal headings and body text are not.
- Review the JavaScript loaded by the shared rich-text components and demos. The
  build contains a 701 KB Lexical-related chunk, about 218 KB when gzipped, and a
  662 KB shared chunk, about 143 KB gzipped. These are artifact sizes, not measured
  transfer totals or a Core Web Vitals score. Measure production loading before
  choosing which modules to defer.
- After deployment, submit `https://prompt.studio/sitemap.xml` in Search Console
  and inspect the four new example URLs. Local inspection cannot confirm what
  Google has indexed or which canonical it selects.

The audit inspected all nine canonical HTML responses, the examples entry, the
error page, the sitemap, and robots.txt. Each example's source HTML contains its
heading, description, active tab, and four crawlable example links. Direct loads,
tab navigation, and Back retained the selected example and matching metadata.
The download panel stayed mounted during tab changes. Mobile layouts at 320px
and 390px contained the page width and placed the introduction after the content;
the desktop layout retained its 480px left panel. A browser context with JavaScript
disabled could open an example and follow its links.

Shared UI, landing-page, and Storybook builds passed. Formatting and landing-page
TypeScript checks passed. Automated test suites were skipped at the user's request.
