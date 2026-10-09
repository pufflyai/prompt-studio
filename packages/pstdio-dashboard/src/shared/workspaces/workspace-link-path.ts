const cleanSegments = (path: string) => {
  const result: string[] = [];
  for (const segment of path.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (!result.length) throw new Error("This path is outside the session workspace.");
      result.pop();
    } else result.push(segment);
  }
  return result;
};

export const workspaceLinkPath = (path: string, root: string | null) => {
  const windows = /^[a-z]:\//i.test(path);
  const rooted = windows || path.startsWith("/");
  if (!rooted) {
    const relative = cleanSegments(path).join("/");
    if (!relative) throw new Error("Select a file inside the session workspace.");
    return relative;
  }
  if (!root) throw new Error("The session workspace has no local file root.");
  const normalizedRoot = root.replaceAll("\\", "/").replace(/\/+$/, "");
  const rootWindows = /^[a-z]:\//i.test(normalizedRoot);
  if (windows !== rootWindows) throw new Error("This path is outside the session workspace.");
  const source = cleanSegments(path);
  const base = cleanSegments(normalizedRoot);
  const matches = base.every((part, index) =>
    windows ? part.toLowerCase() === source[index]?.toLowerCase() : part === source[index],
  );
  if (!matches || source.length <= base.length) throw new Error("This path is outside the session workspace.");
  return source.slice(base.length).join("/");
};
