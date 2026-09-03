# Third-party notices

LabSpace Atlas includes open-source packages under their own licences. This
file is an attribution aid; it does not replace the licence text distributed
with each package. `package-lock.json` is the authoritative version lock, and
installed packages retain their licence files under `node_modules/` after
`npm ci`.

## Runtime dependencies

| Package                 | Locked version | Licence    |
| ----------------------- | -------------: | ---------- |
| `@phosphor-icons/react` |         2.1.10 | MIT        |
| `@react-three/drei`     |         10.7.7 | MIT        |
| `@react-three/fiber`    |          9.6.1 | MIT        |
| `@vitejs/plugin-react`  |          5.0.4 | MIT        |
| `clsx`                  |          2.1.1 | MIT        |
| `express`               |          5.2.1 | MIT        |
| `konva`                 |         10.3.0 | MIT        |
| `pdfjs-dist`            |        6.3.289 | Apache-2.0 |
| `qrcode`                |          1.5.4 | MIT        |
| `react`                 |         19.2.0 | MIT        |
| `react-dom`             |         19.2.0 | MIT        |
| `react-konva`           |         19.2.5 | MIT        |
| `three`                 |        0.185.1 | MIT        |
| `vite`                  |          6.4.2 | MIT        |
| `zod`                   |          4.4.3 | MIT        |
| `zustand`               |         5.0.14 | MIT        |

## Direct development dependencies

The direct development toolchain is MIT-licensed except for Playwright,
TypeScript, and their applicable components under Apache-2.0. It includes
ESLint, Prettier, Vitest, jsdom, `tsx`, `cross-env`, React/Node/Three/Express
type packages, and `webmcp-types`.

## Other tools and marks

- Playwright 1.61.1 and TypeScript 6.0.3 are used under Apache-2.0.
- Blender is a GPL-licensed authoring tool and is not part of the production
  web bundle.
- Product names and trademarks mentioned in reference documentation belong to
  their respective owners and imply no affiliation or endorsement.
- LabSpace Atlas visual assets, screenshots, 3D models, and brand artwork are
  governed separately by [LICENSE-ASSETS.md](LICENSE-ASSETS.md) and
  [ASSET_LICENSES.md](ASSET_LICENSES.md).

To inspect the complete transitive dependency tree and exact versions, run
`npm ci` followed by `npm ls --all`, then consult each installed package's
licence file.
