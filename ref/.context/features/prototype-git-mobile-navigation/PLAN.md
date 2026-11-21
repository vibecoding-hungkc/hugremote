---
feature: prototype-git-mobile-navigation
description: Prototype-only Git list-to-details navigation for mobile and tablet; desktop layout unchanged.
status: done
created: 2026-11-05
---
# Git mobile/tablet repository navigation prototype

## Goal
On narrow screens, show a repository list first, then a repo-specific changes screen similar to the original Git file list, including file status/stage labels and + / - line counts.

## Scope
- In scope: analysis/prototypes/prototype.html responsive layout and prototype interactions.
- Out of scope: app production source and deployment until user approval.

## Acceptance Criteria
- [x] AC1: At 390px and 820px the Git tab initially shows the repo list, hides changes, selecting a repo shows details and a working back action — Check: real browser DOM and clicks.
- [x] AC2: Detail view shows changed file paths, status/stage labels and positive/negative line counts, and clicking a file updates the diff — Check: browser DOM, computed values and click flow.
- [x] AC3: At 1280px the existing simultaneous two-column layout remains, with no visible mobile back action — Check: browser geometry and DOM visibility.
- [x] AC4: No horizontal document overflow on 390px and 820px; existing prototype UI audit passes — Check: browser geometry and node scripts/test_ui_monochrome_theme.mjs.

## Tasks
- [x] T1: Add mobile-only list/detail CSS and back button.
- [x] T2: Wire navigation and file metadata for mobile, keeping desktop DOM and behavior.
- [x] T3: Exercise mobile, tablet and desktop in browser and verify tests.

## Risks / Notes
- Prototype fixtures include simplified diff lines; derive line counts from their diff content without inventing backend statistics. This is not production implementation.
