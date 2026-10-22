# Decisions

Reuse GitService parsing/operations via scoped executor over existing sshPool. Never resolve remote cwd using local home. No version bump or release in this fix. Isolate all mutating Git checks.
