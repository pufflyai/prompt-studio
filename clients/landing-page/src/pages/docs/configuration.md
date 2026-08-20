---
layout: ../../layouts/docs-layout.astro
title: Configuration
description: Customize Prompt Studio to fit your workflow.
section: Introduction
order: 2
---

## Config file

After running `pst projects create`, you will find `.pstdio/config.json`. It links the repository to a Prompt Studio project.

```json
{
  "project_id": "<project-id>"
}
```

Prompt Studio stores project and agent settings through its API. Use `pst projects view` and `pst agents list` to inspect them.

## Environment variables

Store secrets such as API keys in environment variables, not `.pstdio/config.json`.
