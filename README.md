# Hermes-Agent-Wrapper

Hermes-Agent-Wrapper is a local-first dashboard wrapper for three Hermes surfaces that are otherwise scattered across files and agent metadata:

- daily memory notes
- reusable skills
- archived heartbeat history

This MVP defines the boundary of the product by turning those three sources into one inspectable snapshot and a small browser UI.

## Current slice

- parse `memory/YYYY-MM-DD.md` into timeline events plus source/activity boundary highlights
- parse archived `HEARTBEAT.md` items into accomplishment history with recent shipped project summaries
- summarize local Hermes skills by category and highlight the densest skill areas
- expose a single `/api/snapshot` payload plus a zero-build dashboard with a dedicated wrapper-boundary panel
- expose a wrapper-surface catalog that shows which memory directory, heartbeat file, and Hermes skill tree are currently being visualized, plus freshness/count metadata for each surface
- add chart-ready visualization lanes for memory cadence, archived task type mix, and skill-category density so the wrapper boundary reads like a product surface instead of raw lists

## Snapshot shape

`/api/snapshot` now includes a `dataSources` block alongside the boundary summary:

```json
{
  "dataSources": {
    "memory": {
      "path": "/Users/fini/.openclaw/workspace-coder/memory",
      "dailyNotes": 13,
      "latestDate": "2026-04-17"
    },
    "history": {
      "path": "/Users/fini/.openclaw/workspace-coder/HEARTBEAT.md",
      "archivedTasks": 7,
      "latestCompletedOn": "2026-04-28"
    },
    "skills": {
      "path": "/Users/fini/.hermes/profiles/coder/skills",
      "skillCount": 83,
      "categoryCount": 21,
      "densestCategory": "software-development"
    }
  }
}
```

## Run

```bash
npm test
npm start
```

Open `http://127.0.0.1:4387`.
