// A project shorthand doubles as the allocation prefix for resource kinds that declare
// `projectPrefix()`, so it has to be an uppercase prefix of at most 16 characters and
// must never be the prefix workspaces reserve for themselves.
const MAX_LENGTH = 16;
const RESERVED_PREFIX = "WS";
const FALLBACK = "PRJ";

export const deriveShorthand = (name: string) => {
  const words = name
    .replace(/[^a-zA-Z\s\-_]/g, "")
    .split(/[\s\-_]+/)
    .filter(Boolean);
  const initials = words
    .map((word) => word[0].toUpperCase())
    .join("")
    .slice(0, MAX_LENGTH);

  if (!initials) return FALLBACK;
  if (initials !== RESERVED_PREFIX) return initials;
  // Lengthen the first word rather than hand back the reserved prefix. A one-letter
  // first word leaves nothing to lengthen, so the name yields no usable prefix at all.
  const lengthened = `${words[0].slice(0, 2).toUpperCase()}${words[1][0].toUpperCase()}`;
  return lengthened === RESERVED_PREFIX ? FALLBACK : lengthened;
};
