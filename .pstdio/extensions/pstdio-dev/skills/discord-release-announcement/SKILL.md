---
name: discord-release-announcement
description: Draft, publish, or update Prompt Studio release announcements in Discord, including release highlights, Markdown formatting, screenshots, blog GIFs, accessible attachments, and publication verification. Use when asked for a Discord release announcement or to add release media to one.
---

# Discord release announcement

## Scope and destination

Follow the user's requested versions and action. A request to draft an announcement authorizes drafting. Send, edit, or publish messages only when the user requests those actions. Loading this skill does not authorize posting. Use an available Discord connector or the signed-in browser/app through the computer-use tools.

The default destination is the Prompt Studio server's `🚨┃announcements` channel:

- Server ID: `1086313238960025631`
- Channel ID: `1554616623929761812`
- Channel URL: https://discord.com/channels/1086313238960025631/1554616623929761812

Verify the visible server and channel before sending. Read recent announcements to match their tone and check whether the requested release already has a post. Update the existing post when requested; avoid duplicates. Do not add `@everyone` or `@here` unless requested.

## Gather release facts

1. Read the requested GitHub release notes, changelog, and matching blog post. Blog sources live in `clients/landing-page/src/content/blog/`; recordings live in `documentation/images/`. Draft blog files are reference material, not public links.
2. Verify the release is published and its downloads are available. For this repo, inspect the actual tag with `gh release view 'pstdio@<version>' --json url,body,isDraft,isPrerelease,publishedAt,assets`. Never invent a release tag or infer shipping from merged commits alone.
3. Check newer changes against the released tag before including them. Include shipped user benefits, relevant fixes, and extension API changes. Leave unreleased changes out. Describe project search as search within the project, not online research.
4. When versions ship together, make one announcement that explains the combined updates and links the actual download release. Use separate highlight groups only when useful.
5. Use released wording: "is out", "now available", or "adds". Do not call a released feature a "preview". If publishing is blocked by a draft or missing downloads, report the blocker and keep the announcement as a draft.

Open every final link. Use the public blog URL only when it is live; omit an unpublished blog link. Keep local dashboard and review URLs out of Discord.

## Format the message

Keep the complete message under 2,000 characters so it does not depend on Nitro. Use short, simple sentences and three to seven useful highlights. Explain what people can do; leave implementation details in the release notes.

- Start with `## Prompt Studio <version> is out 🎉`.
- Use `**bold**` for section labels and feature names, `- ` for bullets, and backticks for commands.
- Put blank lines between the title, paragraphs, and lists. Use `[label](https://...)` for links.
- Include a download/release-notes link. Add a public blog link when available.
- Call out breaking changes or required migration steps if the release contains them.
- Avoid tables, nested lists, long code blocks, and copying the full changelog.

Adapt this structure; replace every placeholder before sending:

```markdown
## Prompt Studio <version> is out 🎉

<One sentence about the main benefit.>

**Highlights**

- **<Feature>:** <What you can now do.>
- **<Feature>:** <What changed for users.>
- **<Fix>:** <What now works reliably.>

<Extension changes or migration steps, when relevant.>

[Download and release notes](<verified release URL>)
[See the workflows in action](<live blog URL>)
```

## Choose screenshots and GIFs

Prefer one relevant GIF from the matching blog for each announcement. Use a PNG or JPEG screenshot when a still image explains the feature better, or when no suitable recording exists. Choose one readable light or dark theme; Discord will not swap theme variants.

Inspect the actual media before attaching it. Show the feature named in the text, keep labels readable at inline size, and crop out unrelated windows or overlays. Use sample data and remove secrets or personal information. Avoid redundant images.

For new screenshots or recordings, follow the repository's `AGENTS.md` and media instructions. Run the app in the required isolated Docker environment. Record the real released behavior. Show a visible cursor and click cues when demonstrating links or buttons. Leave enough time to see the result. A queue recording must show drag-and-drop reordering without a floating bubble covering the queue. Agent-native commands should show the command and its result.

Use descriptive filenames, preserve the real file extension, and check the account's current upload limit. If necessary, reduce dimensions or optimize the GIF while keeping text and actions clear. Do not assume a paid account or a fixed upload limit.

## Attach and publish

1. Prepare the final text and media before posting. Upload the local GIF or screenshot as an attachment to the original announcement; a raw image URL can fail to embed. Use the composer's `+` → **Upload a File**, or supported drag-and-drop. The GIF picker is for GIF search, not uploading a blog recording.
2. In the file picker, select the exact file and verify its filename before opening it. On macOS, **Go to Folder** can accept an absolute path; confirm the path field has focus before entering it. Re-read the UI after each action rather than relying on old element references.
3. Confirm the correct attachment is queued. Use **Modify Attachment** (pencil icon) to add short, factual alt text describing the feature and action. Example: "Dragging the third queued message above the first changes the send order." Save it. Add a brief caption if the message does not explain the media. Keep release media visible rather than marked as a spoiler.
4. Review the complete text, links, version, and attachment. Send once when authorized. If sending is uncertain, inspect the channel before retrying.
5. For a request to publish in the announcement channel, click **Publish** on the sent message and complete Discord's confirmation. Verify the **Published** state. Sending a message and publishing it to following servers are separate steps.

## Update an existing announcement

Read the full existing message before editing. Preserve useful links and formatting, and verify the complete saved text. Do not assume the edit form can add attachments: inspect its current controls. When an authorized media update cannot attach to the original, use a captioned reply directly beneath it and explain that limitation. Do not delete and repost the announcement unless requested.

A reply is a separate message. Do not claim it reached following servers without verifying its own publication state. Published text edits propagate to followers, but this does not prove a new media reply was published.

## Verify and hand off

Check the final rendered message for the correct version, readable formatting, working links, and the expected attachment. Observe more than one GIF frame to confirm the action plays; also check that a still frame remains useful when autoplay is disabled. Confirm alt text was saved and publication succeeded when requested.

Return the message permalink when available. State whether you created a post, edited one, or added a media reply, and whether it was published to following servers. Report any upload or permission blocker without claiming success. For a draft, return the exact message and the selected media path instead.

## Discord references

Check these official guides when the UI or limits differ:

- [Sending messages and character limits](https://support.discord.com/hc/en-us/articles/360034632292-Sending-Messages)
- [Markdown formatting](https://support.discord.com/hc/en-us/articles/210298617-Markdown-Text-101-Chat-Formatting-Bold-Italic-Underline)
- [Uploading images and GIFs, including alt text](https://support.discord.com/hc/en-us/articles/211866427-How-do-I-upload-images-and-GIFs)
- [Announcement channels and publishing](https://support.discord.com/hc/en-us/articles/360032008192-Announcement-Channel-FAQ)
