export { downloadProjectFile, readProjectFile } from "./adapters/project-file";
export {
  DEFAULT_CHIP_COLOR,
  EMPTY_CIRCUIT,
  newChip,
  piece,
  pinDef,
  pinPiece,
  projectWith,
  wire,
} from "./domain/builders";
export { chipsUsing, findChip, replaceChip } from "./domain/chips";
export { canPlace, containsChip, type PlaceError } from "./domain/containment";
export { createDemoProject } from "./domain/demo";
export { importErrorMessage, type ImportError } from "./domain/errors";
export {
  CURRENT_FORMAT_VERSION,
  MAX_IMPORT_BYTES,
  ProjectFileSchema,
  parseProjectFile,
  parseStoredProject,
  serializeProject,
  serializeStoredProject,
} from "./domain/format";
export {
  defaultChain,
  migrateToCurrent,
  type Migration,
  type MigrationChain,
} from "./domain/migrations";
export { isHexColor } from "./domain/model";
export { endpointInfo, pinKeys, type EndpointInfo, type PinRole } from "./domain/pins";
export {
  applySavedVersion,
  planSave,
  type SaveEffect,
  type SaveError,
  type SavePlan,
} from "./domain/save-cascade";
export {
  checkConnection,
  findInvalidWire,
  type Connection,
  type ConnectionError,
} from "./domain/wiring";
export type {
  BitWidth,
  BusWidth,
  Chip,
  ChipInstance,
  Circuit,
  Folder,
  InstanceKind,
  PinDef,
  PinDirection,
  PinKey,
  PinRef,
  Point,
  Project,
  Wire,
} from "./domain/model";
