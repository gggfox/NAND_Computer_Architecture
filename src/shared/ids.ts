import { z } from "zod";

export const ProjectIdSchema = z.uuid().brand<"ProjectId">();
export type ProjectId = z.infer<typeof ProjectIdSchema>;

export const ChipIdSchema = z.uuid().brand<"ChipId">();
export type ChipId = z.infer<typeof ChipIdSchema>;

export const InstanceIdSchema = z.uuid().brand<"InstanceId">();
export type InstanceId = z.infer<typeof InstanceIdSchema>;

export const PinIdSchema = z.uuid().brand<"PinId">();
export type PinId = z.infer<typeof PinIdSchema>;

export const WireIdSchema = z.uuid().brand<"WireId">();
export type WireId = z.infer<typeof WireIdSchema>;

export const newProjectId = (): ProjectId => ProjectIdSchema.parse(crypto.randomUUID());
export const newChipId = (): ChipId => ChipIdSchema.parse(crypto.randomUUID());
export const newInstanceId = (): InstanceId => InstanceIdSchema.parse(crypto.randomUUID());
export const newPinId = (): PinId => PinIdSchema.parse(crypto.randomUUID());
export const newWireId = (): WireId => WireIdSchema.parse(crypto.randomUUID());

export const FolderIdSchema = z.uuid().brand<"FolderId">();
