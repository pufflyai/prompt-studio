# Temporarily review landing page adjustments in Storybook

## Status

Temporary workaround for the PS-67 landing page adjustments.

## Ideal design and external limit

The canonical Pencil design should record the mobile layout, release badge, and shader scroll areas before code changes. The Pencil CLI is unavailable in this environment, and the Pencil transport cannot access its instructions without an open editor. The design cannot be read or changed through the required tool.

## Decision and trade-offs

Apply the user's explicit visual changes using existing theme tokens and the shared ScrollArea. Record the states in Storybook and check the isolated website with Playwright. This makes the result reviewable, but leaves the Pencil design out of sync until its tool is available.

## Isolation and removal

This exception covers only these landing page adjustments. Keep styles in the landing recipes and do not edit the design file by hand. When Pencil is available, update the matching frames, compare them with the stories and mobile preview, and mark this decision superseded.
