import { checkConnection } from "~/features/projects";
import type { Circuit, Wire, WireColor } from "~/features/projects";
import type { WireId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { EditorError } from "./actions";
import { editDraft } from "./circuit-edits";
import type { Edit } from "./circuit-edits";
import { settled } from "./route-edits";

/** Connects two pins and routes only the new wire; with no legal route it keeps the elbow. */
export const connectWire: Edit<"connectWire"> = (project, action) =>
  editDraft(project, action.chipId, (circuit) => {
    if (circuit.wires.some((item) => item.id === action.wireId)) {
      return err({ type: "DuplicateWire", wireId: action.wireId });
    }
    const connection = checkConnection(project, circuit, action.from, action.to);
    if (!connection.ok) {
      return connection;
    }
    const stored: Wire = {
      id: action.wireId,
      ...connection.value,
      waypoints: [],
      manualWaypoints: false,
      ...(action.color === undefined ? {} : { color: action.color }),
    };
    const added = { ...circuit, wires: [...circuit.wires, stored] };
    return ok(settled({ project, circuit: added }, new Set([action.wireId])));
  });

/** The first of `wireIds` not in the circuit, as an error. */
const missingWire = (circuit: Circuit, wireIds: readonly WireId[]): EditorError | undefined => {
  const known = new Set(circuit.wires.map((item) => item.id));
  const missing = wireIds.find((wireId) => !known.has(wireId));
  return missing === undefined ? undefined : { type: "WireNotFound", wireId: missing };
};

/** Runs `edit` once the list is non-empty and every wire in it exists. */
const editWires = (
  circuit: Circuit,
  request: { readonly wireIds: readonly WireId[]; readonly empty: EditorError },
  edit: (wireIds: ReadonlySet<WireId>) => Circuit,
): Result<Circuit, EditorError> => {
  if (request.wireIds.length === 0) {
    return err(request.empty);
  }
  const missing = missingWire(circuit, request.wireIds);
  return missing === undefined ? ok(edit(new Set(request.wireIds))) : err(missing);
};

const recolored = (wire: Wire, color: WireColor | undefined): Wire => {
  const { color: _old, ...rest } = wire;
  return color === undefined ? rest : { ...rest, color };
};

/** Sets (or, with no colour, clears) the colour of every listed wire; routes stay as they are. */
export const recolorWires: Edit<"recolorWires"> = (project, action) =>
  editDraft(project, action.chipId, (circuit) =>
    editWires(
      circuit,
      { wireIds: action.wireIds, empty: { type: "NothingToRecolor" } },
      (wireIds) => ({
        ...circuit,
        wires: circuit.wires.map((wire) =>
          wireIds.has(wire.id) ? recolored(wire, action.color) : wire,
        ),
      }),
    ),
  );

/** Hands the listed wires back to the router (dropping hand bends) and routes them again. */
export const rerouteWires: Edit<"rerouteWires"> = (project, action) =>
  editDraft(project, action.chipId, (circuit) =>
    editWires(
      circuit,
      { wireIds: action.wireIds, empty: { type: "NothingToReroute" } },
      (wireIds) => settled({ project, circuit }, wireIds),
    ),
  );
