---
layout: ../../layouts/docs-layout.astro
title: Configuration
description: Customize Prompt Studio to fit your workflow.
section: Introduction
order: 2
---

## Config File

After running `pst init`, you'll find a configuration file at `.pstdio/config.json`. This file controls how Prompt Studio behaves in your project.

## Options

The configuration supports the following top-level options:

- **`name`** — The display name for your project
- **`version`** — The config schema version

## Agents

You can configure AI agents in the `agents` section of your config. Each agent defines a set of instructions and tools available to it.

```json
{
  "agents": [
    {
      "name": "reviewer",
      "instructions": "Review code for quality and consistency."
    }
  ]
}
```

## Environment Variables

Sensitive values like API keys should be stored in environment variables rather than in the config file.
