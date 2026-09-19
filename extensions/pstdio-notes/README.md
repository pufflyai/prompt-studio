# Notes

Write Markdown notes without leaving Prompt Studio. **Notes** in the project sidebar lists every note; open one to edit
it in the rich Markdown editor, which renders headings, lists, links, tables, and code blocks and saves as you type.

## Multiple documents

- Use **New note** in the notes list to create a document. The title becomes its heading and its file name.
- A note's label in the list follows its first heading, so renaming the heading renames the note.
- Delete a note from its context menu in the list.

## Where notes are stored

Each note is one Markdown file in the project's default repository:

```txt
<repo>/.pstdio/extension-storage/pstdio-notes/documents/<note>.md
```

The extension is installed once per user and works in every project, but the notes themselves belong to the repository.
Commit that directory to share notes with the team, or leave it untracked to keep them local.
