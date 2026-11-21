# Project ID path collision

- [ ] AC1: Two distinct paths with the same basename/long common prefix yield distinct project IDs and both remain selectable. Check: `npx tsx scripts/test_project_id_collision.ts`.
- [ ] AC2: Existing persisted project IDs are migrated without losing project records, active selection or session references. Check: focused migration test with fixture and existing session data.
- [ ] AC3: Real API supports open/select/reload for both paths and browser shows exactly one active row when switching. Check: integration test and browser UI.
- [ ] AC4: Typecheck, relevant UI tests, and build pass. Check npm scripts.
