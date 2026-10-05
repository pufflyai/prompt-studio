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
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      // Use an unquoted date or UTC timestamp. Timestamps order posts published on the same day.
      published: z.date(),
      author: z.enum(["aurelien-franky"]),
      image: image(),
    }),
});

const legal = defineCollection({ loader: glob({ base: "./src/content/legal", pattern: "*.md" }) });

export const collections = { docs, blog, legal };
