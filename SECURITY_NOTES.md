# Security notes

## Local trust model

The prototype binds to the loopback interface and is intended for one trusted Windows user. It has no authentication or authorization and must not be exposed directly to a network or the public internet.

## Data handling

- Project data stays in `data/labspace-indexer.sqlite`.
- No telemetry, analytics, advertising, cloud upload, remote fonts, or paid API is used.
- JSON import is parsed, migrated, and validated with Zod before persistence.
- SQL values use parameterized statements.
- The server disables the Express `X-Powered-By` header.
- The development reset endpoint exists only outside production.
- No secrets are required or stored.

## Deployment cautions

Before multi-user or network deployment, add authentication, authorization, CSRF protection, origin restrictions, rate limits, security headers/CSP, request-size limits, audit logging, encrypted transport, encrypted backups, dependency scanning, and tenant-scoped repository queries. Treat inventory and equipment data as potentially sensitive operational information.

## File exports

Exports may contain complete room, inventory, owner, equipment, and serial-number data. Store exported JSON/CSV files according to the laboratory's data policy.
