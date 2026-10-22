import { Grid, Text } from "@chakra-ui/react";
import { SimpleCard, SimpleCardBody } from "@pstdio/ui";
import type { versionSummary } from "./trend-summary";

interface SummaryTilesProps {
  version: string;
  previous?: string;
  summary: ReturnType<typeof versionSummary>;
}

interface TileProps {
  label: string;
  value: string | number;
  detail: string;
}

const Tile = (props: TileProps) => {
  const { label, value, detail } = props;
  return (
    <SimpleCard>
      <SimpleCardBody display="flex" flexDirection="column" gap="2xs">
        <Text textStyle="label/S/regular" color="fg.muted">
          {label}
        </Text>
        <Text textStyle="heading/XL">{value}</Text>
        <Text textStyle="label/S/regular" color="fg.muted" lineClamp={2}>
          {detail}
        </Text>
      </SimpleCardBody>
    </SimpleCard>
  );
};

export const SummaryTiles = (props: SummaryTilesProps) => {
  const { version, previous, summary } = props;
  const against = previous ? `against ${previous}, 95% confidence` : "First tracked version";
  return (
    <Grid templateColumns="repeat(auto-fit, minmax(14rem, 1fr))" gap="md">
      <Tile label={`Improved in ${version}`} value={summary.improved} detail={`↓ ${against}`} />
      <Tile
        label={`Regressed in ${version}`}
        value={summary.regressed.length}
        detail={summary.regressed.length ? `↑ ${summary.regressed.join(", ")}` : `↑ ${against}`}
      />
      <Tile
        label={`Over budget in ${version}`}
        value={summary.overBudget}
        detail={`Of ${summary.budgeted} metrics with a performance budget`}
      />
    </Grid>
  );
};
