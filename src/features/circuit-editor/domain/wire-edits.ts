import { checkConnection } from "~/features/projects";
import type { Circuit, Project, Wire, WireColor } from "~/features/projects";
import type { WireId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { EditorAction, EditorError } from "./actions";
import { editDraft } from "./circuit-edits";
import type { Edit } from "./circuit-edits";
import type { Scene } from "./geometry";
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

type Connect = Extract<EditorAction, { type: "connectWires" }>;

/** Adds each wire to the circuit in turn, checked against the wires before it. */
const grownBy = (project: Project, circuit: Circuit, action: Connect) => {
  const wires = [...circuit.wires];
  const draft = { ...circuit, wires };
  for (const request of action.wires) {
    if (wires.some((item) => item.id === request.wireId)) {
      return err<EditorError>({ type: "DuplicateWire", wireId: request.wireId });
    }
    const connection = checkConnection(project, draft, request.from, request.to);
    if (!connection.ok) {
      return connection;
    }
    wires.push({
      id: request.wireId,
      ...connection.value,
      waypoints: [],
      manualWaypoints: false,
      ...(action.color === undefined ? {} : { color: action.color }),
    });
  }
  return ok(draft);
};

/** Connects several pins and routes only the new wires, or changes nothing if any is illegal. */
export const connectWires: Edit<"connectWires"> = (project, action) =>
  editDraft(project, action.chipId, (circuit) => {
    if (action.wires.length === 0) {
      return err({ type: "NothingToConnect" });
    }
    const grown = grownBy(project, circuit, action);
    if (!grown.ok) {
      return grown;
    }
    const ids = new Set(action.wires.map((item) => item.wireId));
    return ok(settled({ project, circuit: grown.value }, ids));
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

/** The wire in `color`; the same object when it already is. */
const recolored = (wire: Wire, color: WireColor | undefined): Wire => {
  if (wire.color === color) {
    return wire;
  }
  const { color: _old, ...rest } = wire;
  return color === undefined ? rest : { ...rest, color };
};

/**
 * The colour is part of a wire's signal, so a recoloured automatic wire no longer shares edges
 * with its old trunk: it is routed again around it, while the trunk keeps its route. Wires
 * recoloured alike from one source and bit still share a trunk. Hand bends stay as they are.
 */
const recoloredIn = (scene: Scene, wireIds: ReadonlySet<WireId>, color: WireColor | undefined) => {
  const { circuit } = scene;
  const wires = circuit.wires.map((wire) => (wireIds.has(wire.id) ? recolored(wire, color) : wire));
  const changed = wires.filter((wire, index) => wire !== circuit.wires[index]);
  if (changed.length === 0) {
    return circuit;
  }
  const automatic = changed.filter((wire) => !wire.manualWaypoints).map((wire) => wire.id);
  return settled({ ...scene, circuit: { ...circuit, wires } }, new Set(automatic));
};

/** Sets (or, with no colour, clears) the colour of every listed wire, re-routing automatic ones. */
export const recolorWires: Edit<"recolorWires"> = (project, action) =>
  editDraft(project, action.chipId, (circuit) =>
    editWires(
      circuit,
      { wireIds: action.wireIds, empty: { type: "NothingToRecolor" } },
      (wireIds) => recoloredIn({ project, circuit }, wireIds, action.color),
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
