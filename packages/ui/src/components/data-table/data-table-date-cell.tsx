import { Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Tooltip } from "@/components/primitives/tooltip";

const relativeUnits = [
  { unit: "year", seconds: 365 * 24 * 60 * 60 },
  { unit: "month", seconds: 30 * 24 * 60 * 60 },
  { unit: "day", seconds: 24 * 60 * 60 },
  { unit: "hour", seconds: 60 * 60 },
  { unit: "minute", seconds: 60 },
] as const;

const parseDate = (value: unknown) => {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time);
};

export const formatDataTableRelativeDate = (value: unknown, now = new Date(), locale?: string) => {
  const date = parseDate(value);
  if (!date) return null;
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const elapsedSeconds = (date.getTime() - now.getTime()) / 1000;
  const match = relativeUnits.find((candidate) => Math.abs(elapsedSeconds) >= candidate.seconds);
  if (!match) return format.format(0, "second");
  return format.format(Math.round(elapsedSeconds / match.seconds), match.unit);
};

interface DataTableDateCellProps {
  value: string;
}

export const DataTableDateCell = (props: DataTableDateCellProps) => {
  const { value } = props;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const relativeLabel = formatDataTableRelativeDate(value, now);
  const fullDate = new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  return (
    <Tooltip content={fullDate} openDelay={300}>
      <Text as="span" tabIndex={0} textStyle="paragraph/S/regular" color="fg.muted" whiteSpace="nowrap">
        {relativeLabel}
      </Text>
    </Tooltip>
  );
};
