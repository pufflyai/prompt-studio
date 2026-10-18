import { describe, expect, test } from "bun:test";
import { extractLinks, githubSlug, headingAnchors, markdownBlocks } from "./docs-markdown";

describe("markdown links", () => {
  test("finds inline, image, reference, autolink, HTML, and bare links with their lines", () => {
    const text = [
      "# Title",
      "",
      "Read [the guide](guide.md#setup) and ![a GIF](../images/demo.gif 'Demo').",
      "[ref]: https://prompt.studio/docs/",
      "Visit <https://example.com/a> or https://example.com/b.",
      '<img src="../images/still.png" alt="Still">',
      "A link with parentheses: [types](src/a_(b).ts).",
    ].join("\n");

    expect(extractLinks(text)).toEqual([
      { url: "guide.md#setup", line: 3 },
      { url: "../images/demo.gif", line: 3 },
      { url: "https://prompt.studio/docs/", line: 4 },
      { url: "https://example.com/a", line: 5 },
      { url: "https://example.com/b", line: 5 },
      { url: "../images/still.png", line: 6 },
      { url: "src/a_(b).ts", line: 7 },
    ]);
  });

  test("ignores links inside code fences and inline code", () => {
    const text = [
      "Use `[not](a-link.md)` here.",
      "```md",
      "[also not](missing.md)",
      "```",
      "~~~",
      "https://example.com/inside-fence",
      "~~~",
      "[real](real.md)",
    ].join("\n");

    expect(extractLinks(text)).toEqual([{ url: "real.md", line: 8 }]);
  });
});

describe("heading anchors", () => {
  test("uses GitHub slugs for headings with code, links, and punctuation", () => {
    const text = [
      "---",
      "name: skill",
      "---",
      "# Write an extension",
      "## Use `ctx.storage` safely",
      "## Read [the API](api.md): v0.2",
      "### Step 1 — Install!",
      "## FAQ",
      "## FAQ",
      '<a id="custom-anchor"></a>',
      "```",
      "# not a heading",
      "```",
    ].join("\n");

    expect([...headingAnchors(text)]).toEqual([
      "write-an-extension",
      "use-ctxstorage-safely",
      "read-the-api-v02",
      "step-1--install",
      "faq",
      "faq-1",
      "custom-anchor",
    ]);
  });

  test("reads Windows line endings", () => {
    expect([...headingAnchors("---\r\nname: skill\r\n---\r\n# Title\r\n## Next step\r\n")]).toEqual([
      "title",
      "next-step",
    ]);
  });

  test("keeps letters, numbers, underscores, and hyphens", () => {
    expect(githubSlug("rowId / rowIds vs. onRowActivate_row")).toBe("rowid--rowids-vs-onrowactivate_row");
    expect(githubSlug("Café déjà-vu")).toBe("café-déjà-vu");
  });
});

describe("markdown blocks", () => {
  test("splits a document into heading sections and separate table rows", () => {
    const text = [
      "# Reference",
      "Intro",
      "| Group | Methods |",
      "| --- | --- |",
      "| `projects` | `list`, `get` |",
      "## `sessions`",
      "Use `create` and `followUp`.",
      "```ts",
      "client.sessions.get(id)",
      "```",
    ].join("\n");

    expect(markdownBlocks(text)).toEqual([
      "# Reference\nIntro",
      "| Group | Methods |",
      "| `projects` | `list`, `get` |",
      "## `sessions`\nUse `create` and `followUp`.\n```ts\nclient.sessions.get(id)\n```",
    ]);
  });
});
