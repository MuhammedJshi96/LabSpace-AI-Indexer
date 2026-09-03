# Competition evidence layer rollback

This checkpoint isolates the September 2 competition-readiness presentation pass from saved
laboratories, rooms, inventory, asset definitions, and rendering data.

## Baseline

- Branch at start: `codex/local-render-quality`
- Commit at start: `b09220d`
- Existing uncommitted benchmark files are independent work and must not be removed by this rollback.

Pre-change SHA-256 hashes:

| File                                    | SHA-256                                                            |
| --------------------------------------- | ------------------------------------------------------------------ |
| `src/components/AgentActivityPanel.tsx` | `906D5D51C183217E68F213C7C9E247A066937B453A960C4FD8F265723CB70988` |
| `src/styles.css`                        | `898ADC9A1587ACE90EA13124BAC3FE1CD4B80FB401BA77FB35EA093A877BAA8A` |
| `src/components/WorkspacePolish.css`    | `A8B52C8D97AC9069B90BC837999A06FD827CF574A9F40E7F6AA18FFEC2F4B247` |
| `README.md`                             | `EB0CDF839229C8C0F129631C68A8320E71F83D7D58F88138725B2377FCCF3FCC` |

## Instant rollback

Set the build environment variable below and rebuild:

```text
VITE_COMPETITION_EVIDENCE_LAYER=0
```

That restores the former WebMCP Inspector information architecture while leaving the existing
tool registrations, Reviewed/Fast Draft policy, activity history, project persistence, and all
saved user data unchanged.

## Files owned by this layer

- `src/config/competition-evidence.ts`
- `src/agent/judge-evidence.ts`
- `src/components/AgentActivityPanel.tsx` (feature-gated mission surface only)
- `src/components/WorkspacePolish.css` (feature-gated mission styles)
- `tests/unit/judge-evidence.test.ts`
- `tests/e2e/webmcp-mission-control.spec.ts`
- `README.md`
- `docs/webmcp/CHALLENGE_EVIDENCE.md`
- `docs/screenshots/submission-webmcp-mission-control.png`
- `docs/screenshots/submission-webmcp-tools.png`
- `docs/screenshots/submission-webmcp-evidence.png`

The layer is deliberately read-only except for copying prompts and downloading an explicit JSON
evidence file. It never calls a project mutation, modifies the active room, or persists an
execution-mode choice.
