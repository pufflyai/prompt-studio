import { type SQL, sql } from "drizzle-orm";

/** JSONB expands JSON number exponents but retains their exact decimal digits. */
export const recordNumberTextSql = (value: SQL) => sql`(
  SELECT CASE
    WHEN magnitude = 0 THEN '0'
    WHEN magnitude >= 0.000001 AND magnitude < 1e21 THEN
      CASE WHEN position('.' in source) > 0 THEN rtrim(rtrim(source, '0'), '.') ELSE source END
    ELSE
      CASE WHEN left(source, 1) = '-' THEN '-' ELSE '' END ||
      left(digits, 1) || CASE WHEN length(digits) > 1 THEN '.' || substring(digits from 2) ELSE '' END ||
      'e' || CASE WHEN magnitude >= 1e21 THEN '+' || (length(split_part(unsigned, '.', 1)) - 1)::text
        ELSE '-' || (length(fraction) - length(ltrim(fraction, '0')) + 1)::text END
    END
  FROM (
    SELECT source, abs(source::numeric) AS magnitude, unsigned,
      trim(both '0' from replace(unsigned, '.', '')) AS digits,
      split_part(unsigned, '.', 2) AS fraction
    FROM (
      SELECT source, ltrim(source, '-') AS unsigned
      FROM (SELECT ${value} #>> '{}' AS source) AS number_source
    ) AS number_unsigned
  ) AS number_parts
)`;
