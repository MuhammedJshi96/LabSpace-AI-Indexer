/**
 * Reversible presentation-only competition layer.
 *
 * Set VITE_COMPETITION_EVIDENCE_LAYER=0 at build time to restore the previous
 * WebMCP Inspector information architecture. This flag never changes tools,
 * project data, execution policy, or persistence.
 */
export const COMPETITION_EVIDENCE_LAYER_ENABLED =
  import.meta.env.VITE_COMPETITION_EVIDENCE_LAYER !== "0";
