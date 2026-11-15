# Observe visible state throughout the assertion allowance

A packaged cloud Notes check timed out while waiting for an edited note's
sidebar title. The edit was durable and later API replies returned the new
title. The expectation's returned ARIA still showed the old title, while its
after-snapshot contained the new title. Neither response alone established when
the visible interface changed.

The retained trace resolved the timing. The visibility assertion started at
18,626.089 ms. A frame at 23,171.118 ms still showed the old sidebar label; a
frame at 23,420.731 ms visibly showed the new label. That is 4,794.642 ms after
the assertion began, inside its existing 5,000 ms allowance. The expectation
returned a timeout at 23,633.837 ms. Playwright 1.60's locator assertion can wait
500 ms between checks and returns its last intermediate result on timeout;
individual poll evaluations were not recorded by this trace.

For this case, poll the same strict locator's `isVisible()` state every 50 ms
with the same 5,000 ms timeout. This changes observation frequency without
submitting an edit, requesting a flush, refreshing data or extending the
allowance. Keep the whole workflow and original failure evidence. The measured
title latency remains about 4.8 seconds; the change does not improve application
performance or establish that another late-rendering failure has the same cause.

When diagnosing a similar failure, compare timestamped frames, API replies and
the exact assertion predicate before changing an allowance. A later screenshot
alone does not show that the condition held before its deadline. Follow the
[testing rules](../guidance/0005-testing.md) and the
[exact-value approval rule](../guidance/0004-ci.md#3-ci-timeouts-and-performance-budgets).
