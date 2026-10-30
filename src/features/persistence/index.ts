export {
  createMemoryProjectRepository,
  createProjectRepository,
} from "./adapters/idb-project-repository";
export {
  getAppProjectRepository,
  withMemoryFallback,
  type AppProjectRepository,
} from "./adapters/fallback-repository";
export { registerServiceWorker } from "./adapters/service-worker";
export { requestPersistentStorage } from "./adapters/storage-persist";
export { persistenceErrorMessage, type PersistenceError } from "./domain/errors";
export type { ProjectRepository, ProjectSummary } from "./domain/repository";
