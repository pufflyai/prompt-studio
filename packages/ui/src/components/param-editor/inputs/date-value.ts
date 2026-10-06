const calendarDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Formats a read-only date in the viewer's locale and time zone. A calendar date
 * (`YYYY-MM-DD`) has no time zone, so it is read as a local date and never shifts a day.
 */
export const formatReadOnlyDate = (value: string) => {
  const calendarDate = calendarDatePattern.exec(value);
  if (calendarDate) {
    const [, year, month, day] = calendarDate;
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
      new Date(Number(year), Number(month) - 1, Number(day)),
    );
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
};
