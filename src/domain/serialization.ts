import { ProjectSchema, type Project } from "./schema";

export function serializeProject(project: Project): string {
  return JSON.stringify(ProjectSchema.parse(project));
}

export function deserializeProject(value: string): Project {
  return ProjectSchema.parse(JSON.parse(value));
}
