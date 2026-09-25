import { describe, expect, test } from "bun:test";
import { filesWithCopiedText, linesWithSeveralSentences, missingSentences } from "./legal-documents";

describe("legal documents keep one sentence per line", () => {
  test("accepts one sentence per line, list continuations included", () => {
    const markdown = [
      "# Privacy policy",
      "",
      "We respect your privacy.",
      "Email us at [hello@pufflig.com](mailto:hello@pufflig.com).",
      "",
      "- **The right to access** – You can request a copy of your data.",
      "  We may charge a small fee.",
    ].join("\n");

    expect(linesWithSeveralSentences(markdown)).toEqual([]);
  });

  test("reports each line that joins two sentences", () => {
    const markdown = ["# Terms", "", "We change these terms. Registered users get an email.", "One sentence."].join(
      "\n",
    );

    expect(linesWithSeveralSentences(markdown)).toEqual([3]);
  });
});

describe("the served page renders every sentence of its markdown", () => {
  const markdown = [
    "# Privacy policy",
    "",
    "It's important to us.",
    "Visit [allaboutcookies.org](https://allaboutcookies.org).",
    "",
    "- **Functionality** – We remember your preferences.",
  ].join("\n");

  test("passes when the page text holds each sentence", () => {
    const html = `<html><head><title>x</title></head><body>
      <h1>Privacy policy</h1>
      <p>It’s important to us.
      Visit <a href="https://allaboutcookies.org">allaboutcookies.org</a>.</p>
      <ul><li><strong>Functionality</strong> – We remember your preferences.</li></ul>
    </body></html>`;

    expect(missingSentences(markdown, html)).toEqual([]);
  });

  test("ignores text that only exists inside scripts or serialized props", () => {
    const html = `<html><body>
      <h1>Privacy policy</h1>
      <astro-island props="{&quot;html&quot;:&quot;It's important to us.&quot;}"></astro-island>
      <script>const copy = "Visit allaboutcookies.org.";</script>
    </body></html>`;

    expect(missingSentences(markdown, html)).toEqual([
      "It's important to us.",
      "Visit allaboutcookies.org.",
      "Functionality - We remember your preferences.",
    ]);
  });
});

describe("legal text lives only in markdown", () => {
  const markdown = "# Terms\n\nBy accessing our website, you agree to be bound by these terms of service.";

  test("finds a sentence copied into source code", () => {
    const sources = {
      "src/content/legal.ts":
        'export const intro = "By accessing our website, you agree to be bound by these terms of service.";',
      "src/components/footer.tsx": "export const Footer = () => null;",
    };

    expect(filesWithCopiedText(markdown, sources)).toEqual(["src/content/legal.ts"]);
  });

  test("ignores short lines such as headings", () => {
    expect(filesWithCopiedText(markdown, { "src/nav.ts": 'export const label = "Terms";' })).toEqual([]);
  });
});
