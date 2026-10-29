import { z } from "zod";

import { ChipIdSchema, InstanceIdSchema, ProjectIdSchema, WireIdSchema } from "~/shared/ids";

/* oxlint-disable-next-line eslint/id-length -- `x` and `y` are coordinate names */
const PointSchema = z.object({ x: z.number(), y: z.number() }).readonly();
export type Point = z.infer<typeof PointSchema>;

const BuiltinKindSchema = z.enum(["nand", "input", "output", "clock"]);
export type BuiltinKind = z.infer<typeof BuiltinKindSchema>;

const PinRefSchema = z
  .object({ instanceId: InstanceIdSchema, pin: z.number().int().nonnegative() })
  .readonly();
export type PinRef = z.infer<typeof PinRefSchema>;

const BuiltinInstanceKindSchema = z.object({
  type: z.literal("builtin"),
  builtin: BuiltinKindSchema,
});
const CustomInstanceKindSchema = z.object({ type: z.literal("custom"), chipId: ChipIdSchema });
const InstanceKindSchema = z
  .discriminatedUnion("type", [BuiltinInstanceKindSchema, CustomInstanceKindSchema])
  .readonly();

const ChipInstanceSchema = z
  .object({
    id: InstanceIdSchema,
    kind: InstanceKindSchema,
    position: PointSchema,
    label: z.string().optional(),
  })
  .readonly();
export type ChipInstance = z.infer<typeof ChipInstanceSchema>;

const MAX_BIT_WIDTH = 16;

const WireSchema = z
  .object({
    id: WireIdSchema,
    from: PinRefSchema,
    to: PinRefSchema,
    bitWidth: z.number().int().min(1).max(MAX_BIT_WIDTH),
    waypoints: z.array(PointSchema).readonly(),
  })
  .readonly();
export type Wire = z.infer<typeof WireSchema>;

const CircuitSchema = z
  .object({
    instances: z.array(ChipInstanceSchema).readonly(),
    wires: z.array(WireSchema).readonly(),
  })
  .readonly();
export type Circuit = z.infer<typeof CircuitSchema>;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/u;

const ChipSchema = z
  .object({
    id: ChipIdSchema,
    name: z.string(),
    color: z.string().regex(HEX_COLOR),
    circuit: CircuitSchema,
    folderId: z.string().optional(),
    tags: z.array(z.string()).readonly(),
  })
  .readonly();
export type Chip = z.infer<typeof ChipSchema>;

const MAX_UINT32 = 0xff_ff_ff_ff;
const FolderSchema = z.object({ id: z.string(), name: z.string() }).readonly();

export const ProjectSchema = z
  .object({
    id: ProjectIdSchema,
    name: z.string(),
    seed: z.number().int().min(0).max(MAX_UINT32),
    rootCircuit: CircuitSchema,
    chips: z.array(ChipSchema).readonly(),
    folders: z.array(FolderSchema).readonly(),
  })
  .readonly();
export type Project = z.infer<typeof ProjectSchema>;
