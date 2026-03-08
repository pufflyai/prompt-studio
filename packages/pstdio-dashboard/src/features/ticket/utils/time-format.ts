import { format, isSameYear, parseISO } from "date-fns";

export const getTimeFormat = (time: string) => {
  const parsedTime = parseISO(time);
  const currentTime = new Date();

  if (isSameYear(parsedTime, currentTime)) {
    return format(parsedTime, "HH:mm MMM dd");
  }

  return format(parsedTime, "HH:mm MMM dd, yyyy");
};
