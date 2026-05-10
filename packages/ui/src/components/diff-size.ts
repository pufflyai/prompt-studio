export const LARGE_DIFF_LINE_THRESHOLD = 1000;

const countContentLines = (content: string | undefined) => {
  if (!content) return 0;

  const lines = content.split("\n");
  return content.endsWith("\n") ? lines.length - 1 : lines.length;
};

export const getDiffLineCount = (input: {
  additions?: number;
  deletions?: number;
  oldContent?: string;
  newContent?: string;
}) => {
  const changedLines = (input.additions ?? 0) + (input.deletions ?? 0);
  const contentLines = countContentLines(input.oldContent) + countContentLines(input.newContent);

  return Math.max(changedLines, contentLines);
};

export const isLargeDiffContent = (input: {
  additions?: number;
  deletions?: number;
  oldContent?: string;
  newContent?: string;
}) => {
  return getDiffLineCount(input) > LARGE_DIFF_LINE_THRESHOLD;
};
