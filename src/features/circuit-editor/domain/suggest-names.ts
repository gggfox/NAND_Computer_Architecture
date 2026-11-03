import { endpointInfo, pinKeys } from "~/features/projects";
import type { ChipInstance, PinKey, PinRef } from "~/features/projects";
import { groupBy } from "~/shared/group-by";

import type { Scene } from "./geometry";

/** A pin end as the rules see it (D1, D3). `name` is set only for a named pin (custom chip or pin piece). */
export interface End {
  readonly ref: PinRef;
  readonly role: "source" | "sink";
  readonly width: number;
  readonly name?: string;
  /** Where its instance sits in the circuit's instance list (the reading-order tiebreak). */
  readonly order: number;
  /** The part the pin belongs to, for series: the instance, or one shared key for all pin pieces. */
  readonly group: string;
  /** A sink some wire reaches, on any bit (D1). Always false for a source. */
  readonly driven: boolean;
}

const SPLIT = /^(?<stem>.+?)(?:_?(?<plain>\d+)|\[(?<bracketed>\d+)\])$/u;

/** `d0`, `d_0`, `D[0]` → { stem: "d", index: 0 }; `undefined` without a non-empty stem and a number (D6). */
export const splitName = (
  name: string,
): { readonly stem: string; readonly index: number } | undefined => {
  const { stem, plain, bracketed } = SPLIT.exec(name)?.groups ?? {};
  return stem === undefined ? undefined : { stem, index: Number(plain ?? bracketed) };
};

const MIN_SERIES = 2;
const PIECES = "pieces";

const drivenKey = (instanceId: string, pin: PinKey): string => `${instanceId}\u0000${String(pin)}`;

/** The sinks some wire reaches, by instance and pin. */
const drivenSinks = (scene: Scene): ReadonlySet<string> =>
  new Set(scene.circuit.wires.map(({ to }) => drivenKey(to.instanceId, to.pin)));

/** Pin names by key for a part whose pins the user named; empty for built-ins (D3). */
const namesOf = (scene: Scene, { kind }: ChipInstance): ReadonlyMap<PinKey, string> => {
  if (kind.type === "pin") {
    const def = scene.circuit.pins.find((item) => item.id === kind.pinId);
    return new Map(def === undefined ? [] : [[0, def.name]]);
  }
  const saved =
    kind.type === "custom"
      ? scene.project.chips.find((chip) => chip.id === kind.chipId)?.saved
      : undefined;
  return new Map((saved?.pins ?? []).map((def) => [def.id, def.name]));
};

const endsOfInstance = (
  scene: Scene,
  driven: ReadonlySet<string>,
  [instance, order]: readonly [ChipInstance, number],
): readonly End[] => {
  const names = namesOf(scene, instance);
  const group = instance.kind.type === "pin" ? PIECES : instance.id;
  return pinKeys(scene.project, instance).flatMap((pin) => {
    const info = endpointInfo(scene.project, scene.circuit, instance, pin);
    const name = names.get(pin);
    if (info === undefined) {
      return [];
    }
    const sink = info.role === "sink";
    return [
      {
        ref: { instanceId: instance.id, pin },
        role: info.role,
        width: info.width,
        ...(name === undefined || name === "" ? {} : { name }),
        order,
        group,
        driven: sink && driven.has(drivenKey(instance.id, pin)),
      },
    ];
  });
};

/** Every pin end of the circuit, with sinks marked unconnected or not. */
export const endsOf = (
  scene: Scene,
): { readonly sources: readonly End[]; readonly sinks: readonly End[] } => {
  const driven = drivenSinks(scene);
  const ends = scene.circuit.instances.flatMap((instance, order) =>
    endsOfInstance(scene, driven, [instance, order]),
  );
  return {
    sources: ends.filter((end) => end.role === "source"),
    sinks: ends.filter((end) => end.role === "sink"),
  };
};

/** Two or more pins of one part with one stem and different numbers, in number order (D6). */
export interface Series {
  /** Lowercased. */
  readonly stem: string;
  readonly group: string;
  readonly members: readonly { readonly index: number; readonly end: End }[];
  /** The numbers joined, so two series compare by one string. */
  readonly numbers: string;
}

/** The numbered series among `ends`, grouped per part (or per all the pin pieces). */
export const seriesOf = (ends: readonly End[]): readonly Series[] => {
  const numbered = ends.flatMap((end) => {
    const split = end.name === undefined ? undefined : splitName(end.name);
    return split === undefined ? [] : [{ end, index: split.index, stem: split.stem.toLowerCase() }];
  });
  const groups = groupBy(numbered, ({ end, stem }) => `${end.group}\u0000${stem}`);
  return [...groups.values()].flatMap((items) => {
    const members = items.toSorted((a, b) => a.index - b.index);
    const distinct = new Set(members.map(({ index }) => index)).size === members.length;
    // A repeated number (`d1` and `D1`) makes the series ambiguous; it is not one (never guess).
    return members.length < MIN_SERIES || !distinct
      ? []
      : members.slice(0, 1).map(({ stem, end }) => ({
          stem,
          group: end.group,
          members: members.map((member) => ({ end: member.end, index: member.index })),
          numbers: members.map((member) => member.index).join(","),
        }));
  });
};

/** Sources by lowercased name, by lowercased stem (as series), and by width. */
export interface SourceIndex {
  readonly byName: ReadonlyMap<string, readonly End[]>;
  readonly seriesByStem: ReadonlyMap<string, readonly Series[]>;
  readonly allSeries: readonly Series[];
  readonly byWidth: ReadonlyMap<number, readonly End[]>;
}

export const indexSources = (sources: readonly End[]): SourceIndex => {
  const named = sources.filter((end) => end.name !== undefined);
  const allSeries = seriesOf(named);
  return {
    byName: groupBy(named, (end) => (end.name ?? "").toLowerCase()),
    seriesByStem: groupBy(allSeries, (series) => series.stem),
    allSeries,
    byWidth: groupBy(sources, (end) => end.width),
  };
};
