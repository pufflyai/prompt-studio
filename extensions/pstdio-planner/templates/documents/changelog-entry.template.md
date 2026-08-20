## {{VERSION}}

**Date:** {{CREATED_AT}}
**Tags:** tag1, tag2
**Title:** Short summary of this release
**Image:** https://example.com/optional-hero-image.png

Optional longer description of the release.

### Changes

- **Change title** — Description of the change. [Learn more](optional-link)
- **Another change** — Another description.

---

## Field reference

| Markdown                 | Maps to                        | Required |
| ------------------------ | ------------------------------ | -------- |
| `## <version>`           | `entry.version`                | yes      |
| `**Date:** <value>`      | `entry.date`                   | yes      |
| `**Title:** <value>`     | `entry.title`                  | yes      |
| `**Tags:** a, b`         | `entry.tags`                   | no       |
| `**Image:** <url>`       | `entry.image`                  | no       |
| Paragraph after metadata | `entry.description`            | no       |
| `### Changes` list items | `entry.changes[]`              | no       |
| `- **title** — desc`     | `change.title`, `.description` | --       |
| `[Learn more](url)`      | `change.link`                  | no       |

## Parsing rules

1. Split on `---` to get individual entries.
2. The H2 heading is the `version` string.
3. Bold-label lines (`**Key:** value`) are parsed as metadata fields.
4. The first paragraph after all metadata lines is the `description`.
5. Under `### Changes`, each list item becomes a `DocsChangelogChange`:
   - Text before `—` (em dash) is the `title`.
   - Text after `—` is the `description`.
   - A trailing `[Learn more](url)` link becomes `change.link`.
