---
title: "In the future, your users will be part of the development team"
description: Malleable software lets people shape the tools they use, while developers maintain the foundations those tools rely on.
published: 2026-10-06
author: aurelien-franky
image: ../../../../../design/art/blog2.png
---

I think users will become part of the development team.
They will describe a need, work with an agent to build it, try the result, and keep changing it as their work changes.

A lot of the conversation around vibe coding starts with building a whole application: describe an idea, generate the code, and take it from start to finish.
That is useful.
But I am more interested in what happens inside software people already use.

What if a user could add the missing action, build a view for their own workflow, or connect two tools, while the developers keep maintaining the foundations?

## The space between a feature request and a new app

People constantly find small gaps in their tools.
A team wants a different review checklist.
Someone needs a reading list beside their project notes.
Another person wants one button that gathers the information they need before a meeting.

These needs can matter a lot to one person and make little sense as features for everyone.
A developer has to weigh them against the rest of the product.
The user waits, works around the gap, or builds a separate script that needs its own storage, interface, and upkeep.

Code generation creates another option: let the user build the part that belongs to their work, inside the software that already supports it.

That is what I mean by **malleable software**.
People can reshape the tools they use instead of only choosing among the options a team anticipated.

## Developers maintain the foundations

The developer's job becomes more important at this boundary.
They decide which interfaces users can extend, how data is stored, how changes reach other clients, and which operations require permission.
They keep those contracts understandable and reliable as the system evolves.

An extension author can then focus on a smaller problem.
A reading-list tool needs a way to save items, show them, and mark them as read.
It should be able to use the host's shared infrastructure for those jobs.

This is the direction behind Prompt Studio.
The platform supplies agents, workspaces, storage, live sync, and the workbench contracts.
Tools such as Notes and Planner are extensions, and use the same public interfaces available to the tools you build.
In today's alpha, host-side extensions are trusted code running with your user account's access; the extension API is not a security sandbox.

## An agent needs access to the tool it builds

A tool is more useful when an agent can operate it after creating it.
That means exposing the operations behind its interface, with explicit inputs and useful results.

In Prompt Studio, extension authors declare commands.
A toolbar action or menu can call a command, and `cli: true` makes that command available through `pst`.
The same declaration provides parameter flags and help.
The command handler performs the operation, whether a person clicked the action or an agent invoked it from a terminal.

For example, with Notes installed and enabled in a project:

```sh
pst pstdio-notes notes create --help
pst pstdio-notes notes create --title "Meeting notes" --json
```

The second command runs Notes' **New note** operation and returns an execution response.
An agent can check `outcome.ok` and use the returned value on success.
A custom button still has to be connected to a declared command; CLI access does not appear just because a page has a button.

When an agent also needs to inspect a tool's state, its author should add read or list commands.
The agent can then check its work and use the result in another operation.
Our [CLI-ready actions guide](/docs/guides/extensions/cli-ready-actions/) shows the pattern.

## Give users a place in the development loop

The user's contribution starts with knowledge of their own work.
They know which small gap costs them time and what a useful result looks like.
An agent can help turn that description into an extension.
The user can try it, point out what is wrong, and ask for the next change.

![Agent conversation with a request to build a reading-list extension beside the project's Start page](../../../../../documentation/images/new-conversation.png)

*A request to build a reading-list tool in Prompt Studio. This screenshot shows the request, rather than a completed extension.*

For example:

> Build a reading-list tool for this project. Let me add a title and link, list items, and mark an item as read. Give it a page and CLI-ready commands. Show me that an item added from the terminal appears in the page, and that a change in the page appears in the list command.

The user does not need to write the code.
They do need to try the tool and decide whether it does what they asked.
Sharing it with someone else also means maintaining it and checking that it works for their needs.

I want software teams to make this kind of participation possible.
Developers maintain the shared foundations.
Users and their agents build the tools that fit their work, and help shape what those tools become.

If you want to try that loop, [open a project](/docs/guides/getting-started/open-a-project/), [set up an agent](/docs/guides/getting-started/run-agents/), and [ask it to build one small tool](/docs/guides/getting-started/add-tools/#ask-an-agent-to-build-your-tool).
