import { z } from "zod";

import { MAX_STEPS_PER_SECOND, MIN_STEPS_PER_SECOND } from "./clock";
import type { CompileError, NetlistSource } from "./netlist";

/** Generous upper bounds so a hostile message cannot allocate unbounded typed arrays. */
const MAX_SIGNALS = 1_000_000;
export const MAX_SETTLE_TICKS = 100_000;
/**
 * Most gate evaluations (`maxTicks * nandCount`) one settle may ask for. The worker cannot be
 * cancelled, so this bounds how long a settle blocks it. The largest e2e circuit has 300 NANDs,
 * so its longest settle needs 30M evaluations at most and its usual settle needs 300k.
 */
export const MAX_SETTLE_WORK = 50_000_000;

/** True when a settle of `maxTicks` ticks over `nandCount` NANDs is more work than the budget. */
export const exceedsWorkBudget = (maxTicks: number, nandCount: number): boolean =>
  maxTicks * nandCount > MAX_SETTLE_WORK;

const IndexSchema = z.number().int().nonnegative();
const BitSchema = z.union([z.literal(0), z.literal(1)]);

const SignalRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("input"), index: IndexSchema }).readonly(),
  z.object({ kind: z.literal("clock") }).readonly(),
  z.object({ kind: z.literal("nand"), index: IndexSchema }).readonly(),
]);

const NandSchema = z.object({ a: SignalRefSchema, b: SignalRefSchema }).readonly();

const NetlistSourceSchema = z
  .object({
    inputCount: IndexSchema.max(MAX_SIGNALS),
    nands: z.array(NandSchema).max(MAX_SIGNALS).readonly(),
    outputs: z.array(SignalRefSchema).max(MAX_SIGNALS).readonly(),
  })
  .readonly() satisfies z.ZodType<NetlistSource>;

const MaxTicksSchema = z.number().int().min(1).max(MAX_SETTLE_TICKS);

export const ToEngineSchema = z.discriminatedUnion("type", [
  z
    .object({ type: z.literal("load"), source: NetlistSourceSchema, seed: z.number().int() })
    .readonly(),
  z.object({ type: z.literal("setInput"), index: IndexSchema, value: BitSchema }).readonly(),
  z.object({ type: z.literal("settle"), maxTicks: MaxTicksSchema }).readonly(),
  z.object({ type: z.literal("play") }).readonly(),
  z.object({ type: z.literal("pause") }).readonly(),
  z.object({ type: z.literal("step") }).readonly(),
  z
    .object({
      type: z.literal("setSpeed"),
      stepsPerSecond: z.number().min(MIN_STEPS_PER_SECOND).max(MAX_STEPS_PER_SECOND),
    })
    .readonly(),
]);
export type ToEngine = z.infer<typeof ToEngineSchema>;

const CompileErrorSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SignalOutOfRange"), ref: SignalRefSchema }).readonly(),
  z.object({ type: z.literal("InvalidInputCount"), inputCount: z.number() }).readonly(),
]) satisfies z.ZodType<CompileError>;

const EngineErrorSchema = z.union([
  CompileErrorSchema,
  z.object({ type: z.literal("BadMessage") }).readonly(),
  z.object({ type: z.literal("WorkBudgetExceeded") }).readonly(),
]);

export const FromEngineSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("state"),
      tick: IndexSchema,
      stable: z.boolean(),
      outputs: z.array(BitSchema).readonly(),
      clock: BitSchema,
      running: z.boolean(),
    })
    .readonly(),
  z.object({ type: z.literal("error"), error: EngineErrorSchema }).readonly(),
]);
export type FromEngine = z.infer<typeof FromEngineSchema>;
