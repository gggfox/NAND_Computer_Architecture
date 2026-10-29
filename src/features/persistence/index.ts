export {
  createMemoryProjectRepository,
  createProjectRepository,
} from "./adapters/idb-project-repository";
export { requestPersistentStorage } from "./adapters/storage-persist";
export { persistenceErrorMessage, type PersistenceError } from "./domain/errors";
export type { ProjectRepository, ProjectSummary } from "./domain/repository";
