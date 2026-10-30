/* oxlint-disable typescript/prefer-readonly-parameter-types -- parsed values carry branded ids (mutable object types) and zod's refinement context; none is mutated */
import { z } from "zod";

import {
  ChipIdSchema,
  FolderIdSchema,
  InstanceIdSchema,
  PinIdSchema,
  ProjectIdSchema,
  WireIdSchema,
} from "~/shared/ids";

/* oxlint-disable-next-line eslint/id-length -- `x` and `y` are coordinate names */
const PointSchema = z.object({ x: z.number(), y: z.number() }).readonly();
export type Point = z.infer<typeof PointSchema>;

const NIBBLE = 4;
const BYTE = 8;
const WORD = 16;

const BitWidthSchema = z.literal([1, NIBBLE, BYTE, WORD]);
export type BitWidth = z.infer<typeof BitWidthSchema>;

const BusWidthSchema = z.literal([NIBBLE, BYTE, WORD]);
export type BusWidth = z.infer<typeof BusWidthSchema>;

const PinDirectionSchema = z.enum(["input", "output"]);
export type PinDirection = z.infer<typeof PinDirectionSchema>;

const PinDefSchema = z
  .object({
    id: PinIdSchema,
    name: z.string(),
    width: BitWidthSchema,
    direction: PinDirectionSchema,
  })
  .readonly();
export type PinDef = z.infer<typeof PinDefSchema>;

const MAX_BIT_INDEX = 15;

/** A built-in part's pin number, or a custom chip's pin by id (ADR 39). */
const PinKeySchema = z.union([z.number().int().nonnegative(), PinIdSchema]);
export type PinKey = z.infer<typeof PinKeySchema>;

const PinRefSchema = z
  .object({
    instanceId: InstanceIdSchema,
    pin: PinKeySchema,
    bit: z.number().int().min(0).max(MAX_BIT_INDEX).optional(),
  })
  .readonly();
export type PinRef = z.infer<typeof PinRefSchema>;

const InstanceKindSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("nand") }),
    z.object({ type: z.literal("clock") }),
    z.object({ type: z.literal("split"), width: BusWidthSchema }),
    z.object({ type: z.literal("merge"), width: BusWidthSchema }),
    z.object({ type: z.literal("pin"), pinId: PinIdSchema }),
    z.object({ type: z.literal("custom"), chipId: ChipIdSchema }),
  ])
  .readonly();
export type InstanceKind = z.infer<typeof InstanceKindSchema>;

const ChipInstanceSchema = z
  .object({
    id: InstanceIdSchema,
    kind: InstanceKindSchema,
    position: PointSchema,
    label: z.string().optional(),
  })
  .readonly();
export type ChipInstance = z.infer<typeof ChipInstanceSchema>;

const WireSchema = z
  .object({
    id: WireIdSchema,
    from: PinRefSchema,
    to: PinRefSchema,
    bitWidth: BitWidthSchema,
    waypoints: z.array(PointSchema).readonly(),
    manualWaypoints: z.boolean(),
  })
  .readonly();
export type Wire = z.infer<typeof WireSchema>;

interface Issue {
  readonly path: readonly (string | number)[];
  readonly message: string;
}

interface PinPieces {
  readonly pins: readonly { readonly id: string }[];
  readonly instances: readonly {
    readonly kind: { readonly type: string; readonly pinId?: string };
  }[];
}

const pinIdOf = (kind: PinPieces["instances"][number]["kind"]): string | undefined =>
  kind.type === "pin" ? kind.pinId : undefined;

/** Every pin piece names a definition in `pins`, and every definition has exactly one piece. */
const pinPieceIssues = (circuit: PinPieces): readonly Issue[] => {
  const defined = new Set(circuit.pins.map((pin) => pin.id));
  const pieceIds = circuit.instances.map((item) => pinIdOf(item.kind));
  const orphans = pieceIds.flatMap((pinId, index) =>
    pinId === undefined || defined.has(pinId)
      ? []
      : [{ path: ["instances", index], message: "pin piece has no pin definition" }],
  );
  const unpaired = circuit.pins.flatMap((pin, index) =>
    pieceIds.filter((pinId) => pinId === pin.id).length === 1
      ? []
      : [{ path: ["pins", index], message: "pin definition needs exactly one piece" }],
  );
  return [...orphans, ...unpaired];
};

const CircuitSchema = z
  .object({
    pins: z.array(PinDefSchema).readonly(),
    instances: z.array(ChipInstanceSchema).readonly(),
    wires: z.array(WireSchema).readonly(),
  })
  .superRefine((circuit, context) => {
    for (const issue of pinPieceIssues(circuit)) {
      context.addIssue({ code: "custom", path: [...issue.path], message: issue.message });
    }
  })
  .readonly();
export type Circuit = z.infer<typeof CircuitSchema>;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/u;

export const isHexColor = (color: string): boolean => HEX_COLOR.test(color);

const ChipSchema = z
  .object({
    id: ChipIdSchema,
    name: z.string(),
    color: z.string().regex(HEX_COLOR),
    saved: CircuitSchema.optional(),
    draft: CircuitSchema,
    folderId: FolderIdSchema.optional(),
    tags: z.array(z.string()).readonly(),
  })
  .readonly();
export type Chip = z.infer<typeof ChipSchema>;

const FolderSchema = z.object({ id: FolderIdSchema, name: z.string() }).readonly();
export type Folder = z.infer<typeof FolderSchema>;

const MAX_UINT32 = 0xff_ff_ff_ff;

export const ProjectSchema = z
  .object({
    id: ProjectIdSchema,
    name: z.string(),
    seed: z.number().int().min(0).max(MAX_UINT32),
    chips: z.array(ChipSchema).min(1).readonly(),
    lastOpenedChipId: ChipIdSchema,
    folders: z.array(FolderSchema).readonly(),
  })
  .superRefine((project, context) => {
    const ids = new Set(project.chips.map((chip) => chip.id));
    if (ids.size !== project.chips.length) {
      context.addIssue({ code: "custom", path: ["chips"], message: "chip ids must be unique" });
    }
    if (!ids.has(project.lastOpenedChipId)) {
      context.addIssue({
        code: "custom",
        path: ["lastOpenedChipId"],
        message: "lastOpenedChipId names no chip",
      });
    }
  })
  .readonly();
export type Project = z.infer<typeof ProjectSchema>;
