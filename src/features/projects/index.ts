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
export { endpointInfo, type EndpointInfo, type PinRole } from "./domain/pins";
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
