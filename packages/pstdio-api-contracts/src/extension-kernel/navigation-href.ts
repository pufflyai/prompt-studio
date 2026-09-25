export const isNavigationHref = (href: unknown) => {
  if (typeof href !== "string") return false;
  try {
    const { protocol } = new URL(href);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
};
