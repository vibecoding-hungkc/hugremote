# Decisions
Use actual CLI protocol producer if verified; do not hide aliases with an arbitrary hardcoded shortlist. No version bump.
Actual CLI auto-updated before TUI compare: verification uses 2.1.308 matching VSIX, rather than stale initial assumption 2.1.302. Preserve producer-native rows and values even if several resolve to same custom ID; no native Fable/alias hiding. Discovery scoped to target+cwd, TTL30s and local binary identity; never cache errors.
