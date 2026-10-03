export const matchCommandQuery = (text: string) => {
  const fragment = /(?:^|\s)(\/[^\s/]*)$/.exec(text)?.[1];
  if (!fragment) return null;
  return {
    leadOffset: text.length - fragment.length,
    matchingString: fragment.slice(1),
    replaceableString: fragment,
  };
};
