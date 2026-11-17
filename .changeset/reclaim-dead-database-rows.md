---
"pstdio": patch
---
Keep the local database from growing with edit history: reclaim space from rewritten rows while the app runs, and remove two tables that stored data nothing read. Automation run events now number each run's steps 1 to 3.
