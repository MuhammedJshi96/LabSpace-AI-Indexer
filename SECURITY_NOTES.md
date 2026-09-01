# Security notes

## Local trust model

The development server has no authentication or authorization and is intended for one trusted user. It currently listens on all local interfaces, so use it only on a trusted machine/network with the operating-system firewall enabled; do not expose development mode directly to the public internet.

The hosted judge build is a public product demonstration, not a shared laboratory-data service. It gives each visitor an isolated, temporary bootstrap session and then saves that browser's authoritative workspace in IndexedDB. Do not enter sensitive operational data into the public demo. A commercial shared deployment still requires authenticated organizations, authorization, tenant isolation, and the controls listed below.

## Data handling

- Local-mode project data stays in `data/labspace-indexer.sqlite`; the hosted judge build stores the authoritative visitor workspace in that browser's IndexedDB.
- No telemetry, analytics, advertising, cloud upload, remote fonts, or paid API is used.
- User-supplied online inventory image URLs are fetched by the browser from the chosen third-party host and therefore disclose the normal request metadata to that host. Use an embedded local image when that is inappropriate.
- JSON import is parsed, migrated, and validated with Zod before persistence.
- SQL values use parameterized statements.
- The server disables the Express `X-Powered-By` header.
- The development reset endpoint exists only outside production.
- No secrets are required or stored.

## Deployment cautions

Before a commercial multi-user deployment, add authentication, authorization, CSRF protection, origin restrictions, rate limits, a complete CSP/security-header policy, durable scoped audit events, encrypted backups, dependency scanning, tenant-scoped repository queries, retention controls, and documented incident recovery. The current server already applies a 12 MB JSON limit and basic `nosniff`, same-origin referrer, WebMCP permission, and no-cache API headers; those are useful baseline controls, not a production security program. Treat inventory and equipment data as potentially sensitive operational information.

## File exports

Exports may contain complete room, inventory, owner, equipment, and serial-number data. Store exported JSON/CSV files according to the laboratory's data policy.
