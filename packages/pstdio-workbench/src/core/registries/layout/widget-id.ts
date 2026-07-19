export const resolveUniqueWidgetId = (
  widgetIds: ReadonlySet<string>,
  contributionId: string,
  preferredId = contributionId,
) => {
  if (!widgetIds.has(preferredId)) return preferredId;

  let suffix = 1;
  while (widgetIds.has(`${contributionId}:${suffix}`)) suffix += 1;
  return `${contributionId}:${suffix}`;
};
