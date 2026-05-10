export const LARGE_DIFF_CONTENT_LENGTH = 200_000;

export const isLargeDiffContent = (input: { oldContent?: string; newContent?: string }) => {
  const { oldContent = "", newContent = "" } = input;

  return oldContent.length + newContent.length > LARGE_DIFF_CONTENT_LENGTH;
};
