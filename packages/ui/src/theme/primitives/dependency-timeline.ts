export const dependencyTimelineMetrics = {
  cardWidth: 240,
  cardHeight: 68,
  laneGap: 32,
  trackGap: 24,
  rowGap: 40,
  headerHeight: 42,
  emptyHeight: 56,
  bandGap: 16,
  padding: 16,
  trackHeaderHeight: 32,
  newTrackWidth: 120,
  gutterWidth: 72,
  lineX: 58,
  collapsedTrackWidth: 36,
  cardInset: 20,
  markerSize: 12,
};

export const dependencyTimelineTokens = {
  "--dependency-timeline-gutter": `${dependencyTimelineMetrics.gutterWidth}px`,
  "--dependency-timeline-section-header": `${dependencyTimelineMetrics.headerHeight}px`,
  "--dependency-timeline-track-header": `${dependencyTimelineMetrics.trackHeaderHeight}px`,
  "--dependency-timeline-card": `${dependencyTimelineMetrics.cardWidth}px`,
  "--dependency-timeline-marker": `${dependencyTimelineMetrics.markerSize}px`,
};
