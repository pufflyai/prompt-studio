# Notes

Write Markdown notes without leaving Prompt Studio. Expand **Notes** in the project sidebar to see its notes; open one to edit
it in the rich Markdown editor, which renders headings, lists, links, tables, and code blocks and saves as you type.

## Multiple documents

- Use **New note** next to **Notes** to create a titled document with an empty body.
- The **Notes** entry expands or collapses the list. Clicking a note opens its tab, and the sidebar follows the active tab.
- Each note has a unique ID so people can create notes with the same title at the same time.
- Titles are independent of the Markdown body. Editing or clearing the body keeps the title.
- Right-click a note and choose **Rename note** to change its title. The sidebar and open tabs update without changing the body.
- Delete a note from its context menu in the list.

## Where notes are stored

Each note has a directory in the project's default repository. Its title and Markdown body are stored separately:

```txt
<repo>/.pstdio/extension-storage/pstdio-notes/documents/<note-id>/
  title.txt
  content.md
```

The extension is installed once per user and works in every project, but the notes themselves belong to the repository.
Commit that directory to share notes with the team, or leave it untracked to keep them local.
