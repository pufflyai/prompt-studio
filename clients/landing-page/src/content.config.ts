import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { DOCS_PATTERNS } from "./content/docs-topics";

// Docs are read where contributors edit them: `documentation/` and each extension's
// folder. The website keeps no copy.
const docs = defineCollection({
  loader: glob({ base: "../..", pattern: DOCS_PATTERNS, generateId: ({ entry }) => entry }),
});

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "*.md" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // Write it unquoted, `published: 2026-10-05`, so YAML reads it as a date.
    published: z.date(),
    author: z.string(),
    image: z.string().startsWith("/images/").optional(),
  }),
});

const legal = defineCollection({ loader: glob({ base: "./src/content/legal", pattern: "*.md" }) });

export const collections = { docs, blog, legal };
