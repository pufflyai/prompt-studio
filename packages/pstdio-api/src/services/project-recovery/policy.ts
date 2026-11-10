import ignore from "ignore";

export const createRecoveryPolicy = (text: string | null) => {
  if (text?.includes("\0")) throw new Error("The root .pstignore contains invalid text");
  const rules = ignore({ ignorecase: false });
  const exclusions: { pattern: string; matcher: ReturnType<typeof ignore> }[] = [];
  // The recorded text keeps a byte-order mark so it hashes like its file; the rules do not.
  for (const pattern of text?.replace(/^\uFEFF/, "").split(/\r?\n/) ?? []) {
    rules.add(pattern);
    if (pattern && !pattern.startsWith("#") && !pattern.startsWith("!"))
      exclusions.push({ pattern, matcher: ignore({ ignorecase: false }).add(pattern) });
  }
  exclusions.reverse();
  return {
    text,
    classify(path: string, directory = false) {
      if (path === ".pstignore") return { included: true };
      const name = directory && !path.endsWith("/") ? `${path}/` : path;
      if (!rules.test(name).ignored) return { included: true };
      // Traversal uses the directory-aware test API. checkIgnore intentionally
      // applies different directory semantics for the git check-ignore command.
      const matched = exclusions.find(({ matcher }) => matcher.test(name).ignored);
      return { included: false, rule: matched?.pattern };
    },
  };
};
