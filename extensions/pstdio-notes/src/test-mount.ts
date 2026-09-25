export const createNotesMount = () => {
  const files = new Map<string, { content: string; updatedAt: string }>();
  let clock = 0;
  const writeText = async (path: string, content: string) => {
    clock += 1;
    files.set(path, { content, updatedAt: new Date(clock * 1000).toISOString() });
  };
  return {
    files,
    exists: async (path: string) => files.has(path),
    list: async (pattern?: string) =>
      [...files.entries()]
        .filter(([path]) => !pattern || path.endsWith(pattern.replace("*", "")))
        .map(([path, file]) => ({ path, updatedAt: file.updatedAt })),
    readText: async (path: string) => {
      const file = files.get(path);
      if (!file) throw new Error(`Not found: ${path}`);
      return file.content;
    },
    writeText,
    updateText: async (path: string, content: string) => {
      if (!files.has(path)) throw new Error(`Not found: ${path}`);
      await writeText(path, content);
    },
    delete: async (path: string) => {
      for (const file of files.keys()) {
        if (file === path || file.startsWith(`${path}/`)) files.delete(file);
      }
    },
  };
};
