import snapshot from "./public-showcase-project.json";
import { ProjectSchema } from "../src/domain/schema";

/** Explicitly published local snapshot; never reads or rewrites the local SQLite workspace. */
export function createPublicShowcaseProject() {
  return ProjectSchema.parse(structuredClone(snapshot));
}
