# Use a single database baseline for 0.49

A fresh installation and a rebuilt database should have the same schema and migration history.
0.49 creates new installations from one generated migration. The released 0.46 journal
remains a frozen input for converting populated homes, including 0.48 and early 0.49 nightlies.
After conversion has committed and the released tables have been retired, the database adopts
the 0.49 journal in one transaction. A fully converted database can adopt that journal in place.
Future releases append to the 0.49 journal.

The pre-0.46 retirement policy still applies to unsupported older engines. The 0.48 upgrade
preserves saved projects and keeps the 20-second limit through the first saved edit.
