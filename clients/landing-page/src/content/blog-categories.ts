export const BLOG_CATEGORIES = ["release", "thoughts", "tool showcase"] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

export const blogCategoryLabel = (category: BlogCategory) => category[0].toUpperCase() + category.slice(1);
