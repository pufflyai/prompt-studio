# Notes

Notes lets you write Markdown notes inside Prompt Studio and keeps them as files in your project's repository.

## Install

Notes is not installed by default. Open **Settings → Project → Extensions**, find **Notes** under **Available**, and select **Install**. You can also run:

```sh
pst extensions add pstdio-notes
```

You install Notes once for your user, and it works in every project.

## Write notes

Open **Notes** in the project sidebar to see the list of notes. Open a note to edit it in the Markdown editor. The editor shows headings, lists, links, tables, and code blocks as formatted text, and saves as you type.

- Choose **New note** next to **Notes** to create a note. Give it a title. Its body starts empty.
- Selecting a note opens it in a tab and keeps the list of notes in the sidebar. Use the breadcrumb to go back to the project.
- A note's title is separate from its body. Editing or clearing the body keeps the title.
- Right-click a note and choose **Rename note** to change its title. The sidebar and open tabs update. The body stays the same.
- Right-click a note and choose **Delete** to delete it.
- Every note has its own ID, so two people can create notes with the same title at the same time.

Agents can manage notes too:

```sh
pst pstdio-notes notes create --title "Meeting notes"
pst pstdio-notes notes rename --note-id <note-id> --title "New title"
pst pstdio-notes notes delete --note-id <note-id>
```

## Where notes are stored

Each note is a folder in the project's default repository. The title and the Markdown body are separate files:

```txt
<repo>/.pstdio/extension-storage/pstdio-notes/documents/<note-id>/
  title.txt
  content.md
```

Notes belong to the repository, not to Prompt Studio. Commit that folder to share notes with your team, or leave it out of Git to keep them on your computer.
