# Notes

Write Markdown notes without leaving Prompt Studio. Expand **Notes** in the project sidebar to see its notes; open one to edit
it in the rich Markdown editor, which renders headings, lists, links, tables, and code blocks and saves as you type.

## Multiple documents

- Use **New note** next to **Notes** to create a document. The title becomes its heading and the start of its file name.
- The **Notes** entry expands or collapses the list. Clicking a note opens its tab, and the sidebar follows the active tab.
- Each file name includes a unique ID so people can create notes with the same title at the same time.
- A note's label in the list follows its first heading, so renaming the heading renames the note. Without a heading, the label uses its file ID.
- Delete a note from its context menu in the list.

## Where notes are stored

Each note is one Markdown file in the project's default repository:

```txt
<repo>/.pstdio/extension-storage/pstdio-notes/documents/<note>.md
```

The extension is installed once per user and works in every project, but the notes themselves belong to the repository.
Commit that directory to share notes with the team, or leave it untracked to keep them local.
