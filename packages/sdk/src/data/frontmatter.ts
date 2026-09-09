const escapeYamlScalar = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
export const quoteYamlScalar = (value: string) => `"${escapeYamlScalar(value)}"`;

export const findClosingFrontmatterDelimiter = (content: string) => {
  const match = /\n---[ \t]*(?:\r?\n|$)/.exec(content.slice(3));
  if (!match) return null;
  const start = 3 + match.index + 1;
  const end = 3 + match.index + match[0].length;
  return { end, start };
};

export const stripFrontmatter = (content: string) => {
  if (!content.startsWith("---")) return content;
  const delimiter = findClosingFrontmatterDelimiter(content);
  if (!delimiter) return content;
  return content.slice(delimiter.end);
};

export const applyFrontmatter = (frontmatter: string, content: string) => {
  const body = stripFrontmatter(content).replace(/^\n+/, "");
  if (!body) return frontmatter;
  return `${frontmatter}\n\n${body}`;
};

const unescapeYamlScalar = (value: string) => {
  let result = "";
  for (let index = 0; index < value.length; index++) {
    const current = value[index];
    const next = value[index + 1];
    if (current !== "\\" || next === undefined) {
      result += current;
      continue;
    }
    if (next === "n") result += "\n";
    else if (next === '"') result += '"';
    else if (next === "\\") result += "\\";
    else result += `${current}${next}`;
    index++;
  }
  return result;
};

export const unquoteYamlScalar = (value: string) => {
  const quoted = value.match(/^(["'])(.*)\1$/);
  return quoted ? unescapeYamlScalar(quoted[2] ?? "") : value;
};
