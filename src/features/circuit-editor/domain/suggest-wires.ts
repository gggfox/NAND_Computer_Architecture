import { checkConnection } from "~/features/projects";
import type { PinRef, Point } from "~/features/projects";
import type { InstanceId } from "~/shared/ids";

import type { Scene } from "./geometry";
import { pinPosition } from "./geometry";
import { readingOrder } from "./pin-selection";
import { endsOf, indexSources, isNamed, seriesOf } from "./suggest-names";
import type { End, NamedEnd, Series, SourceIndex } from "./suggest-names";

export interface Proposal {
  readonly from: PinRef;
  readonly to: PinRef;
}

/** What the rules share: the scene and the sources, indexed once. */
interface Rules {
  readonly scene: Scene;
  readonly index: SourceIndex;
}

/** What a rule settled: each sink it found a wire for. */
interface Found {
  readonly sink: End;
  readonly proposal: Proposal;
}

const MAX_TIE = 2;

/** A candidate joins another chip's pin to the sink and passes `checkConnection` (D4). */
const legal = ({ scene }: Rules, from: PinRef, to: PinRef): boolean =>
  from.instanceId !== to.instanceId && checkConnection(scene.project, scene.circuit, from, to).ok;

/** Up to two items passing `keep`: enough to tell "exactly one" from a tie. */
const firstTwo = <Item>(items: readonly Item[], keep: (item: Item) => boolean): readonly Item[] => {
  const hits: Item[] = [];
  for (const item of items) {
    if (keep(item)) {
      hits.push(item);
    }
    if (hits.length === MAX_TIE) {
      break;
    }
  }
  return hits;
};

const roundOf = <Sink extends End>(
  sinks: readonly Sink[],
  propose: (sink: Sink) => Proposal | undefined,
): readonly Found[] =>
  sinks.flatMap((sink) => {
    const proposal = propose(sink);
    return proposal === undefined ? [] : [{ sink, proposal }];
  });

/** The one proposal among `starts`, or `undefined` for none or a tie. */
const onlyOne = (starts: readonly End[], rules: Rules, sink: End): Proposal | undefined => {
  const hits = firstTwo(starts, (from) => legal(rules, from.ref, sink.ref));
  return hits.length === 1 ? hits.map((from) => ({ from: from.ref, to: sink.ref }))[0] : undefined;
};

/** Rule 1 (D5): the one legal source with the sink's name, ignoring case. */
const byName = (rules: Rules, sinks: readonly NamedEnd[]): readonly Found[] =>
  roundOf(sinks, (sink) =>
    onlyOne(rules.index.byName.get(sink.name.toLowerCase()) ?? [], rules, sink),
  );

/** A way to feed a series: one source per sink, and the name to prefer it by (D6). */
interface Candidate {
  readonly stem: string;
  readonly starts: readonly PinRef[];
}

/** The series' numbers are exactly 0..size-1 and every sink is one bit: a bus can feed it. */
const isBusRange = ({ numbers, members }: Series): boolean =>
  numbers === members.map((_member, bit) => bit).join(",") &&
  members.every(({ end }) => end.width === 1);

const busCandidate = (bus: NamedEnd, series: Series): Candidate => ({
  stem: bus.name.toLowerCase(),
  starts: series.members.map((_member, bit) => ({ ...bus.ref, bit })),
});

const candidatesFor = ({ index }: Rules, series: Series): readonly Candidate[] => {
  const others = index.allSeries
    .filter((item) => item.numbers === series.numbers)
    .map((item) => ({ stem: item.stem, starts: item.members.map(({ end }) => end.ref) }));
  const buses = isBusRange(series)
    ? (index.namedByWidth.get(series.members.length) ?? []).map((bus) => busCandidate(bus, series))
    : [];
  return [...others, ...buses];
};

/** Sink k of the series with the candidate's source k. */
const pairsOf = (series: Series, candidate: Candidate) =>
  series.members.flatMap((member, bit) =>
    candidate.starts.slice(bit, bit + 1).map((from) => ({ sink: member.end, from })),
  );

const feeds = (rules: Rules, candidate: Candidate, series: Series): boolean =>
  pairsOf(series, candidate).every(({ from, sink }) => legal(rules, from, sink.ref));

/** The legal candidates (at most two), taking only those whose stem is `stem` when it is given (D6). */
const pickFrom = (rules: Rules, series: Series, stem?: string): readonly Candidate[] =>
  firstTwo(
    candidatesFor(rules, series).filter((item) => stem === undefined || item.stem === stem),
    (item) => feeds(rules, item, series),
  );

/** The two passes: a matching stem first; a tie there is final, none there tries every one. */
const matchSeries = (rules: Rules, series: Series): Candidate | undefined => {
  const preferred = pickFrom(rules, series, series.stem);
  const hits = preferred.length === 0 ? pickFrom(rules, series) : preferred;
  return hits.length === 1 ? hits[0] : undefined;
};

/** Rule 2 (D6): numbered series to a series of the same numbers, or to a bus. */
const bySeries = (rules: Rules, sinks: readonly End[]): readonly Found[] =>
  seriesOf(sinks).flatMap((series) => {
    const candidate = matchSeries(rules, series);
    return (candidate === undefined ? [] : pairsOf(series, candidate)).map(({ sink, from }) => ({
      sink,
      proposal: { from, to: sink.ref },
    }));
  });

/** Rule 3 (D7): the one source of the sink's width anywhere else on the chip, never a bus's bits. */
const byOnlyOption = (rules: Rules, sinks: readonly End[]): readonly Found[] =>
  roundOf(sinks, (sink) => onlyOne(rules.index.byWidth.get(sink.width) ?? [], rules, sink));

const isPoint = (point: Point | undefined): point is Point => point !== undefined;

/** Where the sink's pin is, as a list of zero or one point. */
const anchorOf = (scene: Scene, { order, ref }: End): readonly Point[] =>
  scene.circuit.instances
    .slice(order, order + 1)
    .flatMap((instance) =>
      [pinPosition(scene, instance, ref.pin)].filter((point) => isPoint(point)),
    );

/** Orders proposals by their sink's place in reading order (D8); each sink has one proposal, so no bit tiebreak. */
const inReadingOrder = (scene: Scene, found: readonly Found[]): readonly Proposal[] => {
  const placed = found.flatMap(({ sink, proposal }) =>
    anchorOf(scene, sink).map((anchor) => ({ anchor, order: sink.order, proposal })),
  );
  return placed.toSorted(readingOrder).map(({ proposal }) => proposal);
};

const unsettled = (
  sinks: readonly End[],
  ...rounds: readonly (readonly Found[])[]
): readonly End[] => {
  const settled = new Set(rounds.flatMap((round) => round.map(({ sink }) => sink)));
  return sinks.filter((sink) => !settled.has(sink));
};

/** Keeps the proposals with an end on a scoped chip (D2); all when there is no scope. */
const inScope = (found: readonly Found[], scope?: ReadonlySet<InstanceId>): readonly Found[] =>
  scope === undefined
    ? found
    : found.filter(
        ({ proposal }) => scope.has(proposal.from.instanceId) || scope.has(proposal.to.instanceId),
      );

/**
 * Wires into unconnected inputs by the three rules in order (D1–D8), in reading order of their sinks.
 * With `scope`, only proposals with an end on one of those chips (D2). Never changes the scene.
 */
export const suggestWires = (
  scene: Scene,
  scope?: ReadonlySet<InstanceId>,
): readonly Proposal[] => {
  const { sources, sinks } = endsOf(scene);
  const rules: Rules = { scene, index: indexSources(sources) };
  const free = sinks.filter((sink) => !sink.driven);
  const first = byName(
    rules,
    free.filter((sink) => isNamed(sink)),
  );
  const second = bySeries(rules, unsettled(free, first));
  const third = byOnlyOption(rules, unsettled(free, first, second));
  const all = [...first, ...second, ...third];
  return inReadingOrder(scene, inScope(all, scope));
};
