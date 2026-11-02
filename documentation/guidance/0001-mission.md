# Mission

## 1. Purpose

1. Prompt Studio exists so that anyone who can direct an agent can build the tools they want and make their own work easier.
2. Tools share the same plumbing instead of rebuilding it. What one tool produces, another can use.
3. Check every feature, fix, and trade-off against this mission. A change that ships today must not block where the product is headed.

## 2. Who Prompt Studio is for

1. Anyone who can describe what they want. A person who never reads code must be able to build, run, change, and trust their tools.
2. A feature that only makes sense to someone who codes is not finished.

## 3. What belongs in core

1. Prompt Studio provides infrastructure every tool needs and no tool should build for itself. Everything else is an extension.
2. Agents and where they work: sessions, workspaces, and the machines work runs on.
3. The extension platform: installing, enabling, and running the tools people build.
4. UI contracts: the workbench, its layout, and how tools appear in it.
5. State and storage: what tools persist and where it lives.
6. Live sync: every client and agent seeing the same state.
7. Security and trust: keeping secrets away from tools and limiting what a tool may touch.
8. User attention: notifications and what may interrupt a person.
9. This list is closed. Extending it requires a human decision and an edit to this document.
10. A feature enters core only when extensions cannot build it or most extensions need it. One tool wanting it is not enough, even when core could ship it faster.

## 4. Product boundaries

1. Project trackers, code editors, and consoles for monitoring agent runs belong in extensions. Core must never compete with its own extensions.
2. Our own extensions use the same public interfaces as anyone else's. If a first-party tool needs a private API, fix the platform.
3. A new person must reach a working tool without reading documentation.
4. Whatever a person can do, an agent can do through the same interface with the same permissions, and the reverse.

## 5. Where the product is headed

1. Today's decisions must not make these directions harder.
2. Work can run on other machines. A hosted offering is fine as long as what a person builds stays theirs.
3. A tool one person builds can be picked up by a team or a community.
4. People who never open code can build and run their own tools.
5. Agents propose, build, and maintain tools, not only run tasks.

## 6. Mission test

1. Before planning a feature or fix, check whether it helps someone build or use a tool they would not have bothered with before.
2. Check whether an extension could provide it instead of core.
3. Check whether it works for a person who never reads code.
4. Check whether an agent can drive it end to end.
5. Check whether it makes any direction in section 5 harder.
6. If an answer is off-mission and you cannot fix it, raise it.
