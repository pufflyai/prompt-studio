# Mission

Prompt Studio exists so that anyone who can direct an agent can build the tools they want, and make their own work easier.

Tools built on Prompt Studio share the same plumbing instead of each rebuilding it. And because they live in one place, they can work together: what one tool produces, another can use.

> Check every feature, fix, and trade-off against this page. A change that ships today but blocks where we are headed costs more than it is worth.

## Who is Prompt Studio for

Anyone who can describe what they want. A person who never reads the code must be able to build, run, change, and trust their tools. A feature that only makes sense to someone who codes is not finished.

## What Prompt Studio is

Prompt Studio is plumbing: the infrastructure every tool needs and no tool should build for itself. Everything else is an extension.

Prompt Studio covers exactly these areas:

- Agents and where they work: sessions, workspaces, and the machines work runs on.
- The extension platform: installing, enabling, and running the tools people build.
- UI contracts: the workbench, its layout, and how tools appear in it.
- State and storage: what tools persist and where it lives.
- Live sync: every client and agent seeing the same state.
- Security and trust: keeping secrets away from tools and limiting what a tool may touch.
- User attention: notifications, and what may interrupt a person.

> **This list is closed.** Work that does not fit one of these areas is not Prompt Studio work and makes more sense as an Extension. Extending the list is a human decision, made by editing this page. Fitting an area is not enough on its own: rule 1 below still applies, and the core takes only what extensions cannot build for themselves or what most extensions need.

## What Prompt Studio is not

A project tracker, a code editor, a console for monitoring agent runs: each of these can and should exist as something a person builds on top of Prompt Studio. None of them is the product, and the core must never compete with its own extensions.

## Rules

1. A feature enters the core only when extensions cannot build it, or when most extensions need it. One tool wanting it is not enough, even when the core version would ship faster.
2. Our own extensions use the same public interfaces as anyone's. When a first-party tool needs a private API, the platform is broken, not the tool.
3. A new person reaches a working tool without reading any documentation.
4. Whatever a person can do, an agent can do through the same interface with the same permissions, and the reverse.

## Where we are headed

A decision today must not make any of it harder.

- Work can run on machines that are not yours. A hosted offering is fine as long as what a person builds stays theirs.
- A tool one person builds can be picked up by a team or a community.
- People who never open the code build and run their own tools.
- Agents propose, build, and maintain tools, not only run tasks.

## The test

Before planning a feature or a fix, answer:

1. Does this help someone build or use a tool they would not have bothered with before?
2. Could an extension provide this instead of the core?
3. Does it work for a person who never reads code?
4. Can an agent drive it end to end?
5. Does it make anything under "Where we are headed" harder?

A wrong answer you cannot fix means the change is off-mission. Raise it.
