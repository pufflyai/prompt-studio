// Bun reads this flag before executing preloads. Child tools must run as ordinary CLIs.
delete process.env.BUN_BE_BUN;
