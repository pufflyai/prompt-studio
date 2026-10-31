export const scrollingMarkdown = Array.from(
  { length: 30 },
  (_, index) => `Paragraph ${index + 1}: select this text and scroll to check the formatting menu.`,
).join("\n\n");
