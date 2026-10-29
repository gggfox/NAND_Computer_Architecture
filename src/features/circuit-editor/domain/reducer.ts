import type { ChipInstance, Circuit, Point, Project } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { assertNever } from "~/shared/assert-never";
import type { InstanceId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { EditorAction, EditorError } from "./actions";

const withCircuit = (project: Project, rootCircuit: Circuit): Project => ({
  ...project,
  rootCircuit,
});

const isProtected = (instance: ChipInstance): boolean =>
  instance.kind.type === "builtin" &&
  (instance.kind.builtin === "input" || instance.kind.builtin === "output");

const notFound = (instanceId: InstanceId): Result<never, EditorError> =>
  err({ type: "InstanceNotFound", instanceId });

type Outcome = Result<Project, EditorError>;

const place = (project: Project, instance: ChipInstance): Outcome => {
  const { instances } = project.rootCircuit;
  if (instances.some((item) => item.id === instance.id)) {
    return err({ type: "DuplicateInstance", instanceId: instance.id });
  }
  return ok(withCircuit(project, { ...project.rootCircuit, instances: [...instances, instance] }));
};

const move = (project: Project, instanceId: InstanceId, position: Point): Outcome => {
  const { instances } = project.rootCircuit;
  if (!instances.some((item) => item.id === instanceId)) {
    return notFound(instanceId);
  }
  // oxlint-disable-next-line oxc/no-map-spread -- immutable update of one element; the array is small and replaced wholesale
  const moved = instances.map((item) => (item.id === instanceId ? { ...item, position } : item));
  return ok(withCircuit(project, { ...project.rootCircuit, instances: moved }));
};

const remove = (project: Project, instanceId: InstanceId): Outcome => {
  const { instances, wires } = project.rootCircuit;
  const target = instances.find((item) => item.id === instanceId);
  if (target === undefined) {
    return notFound(instanceId);
  }
  if (isProtected(target)) {
    return err({ type: "ProtectedInstance", instanceId });
  }
  return ok(
    withCircuit(project, {
      instances: instances.filter((item) => item.id !== instanceId),
      wires: wires.filter(
        (wire) => wire.from.instanceId !== instanceId && wire.to.instanceId !== instanceId,
      ),
    }),
  );
};

export const applyAction = (project: Project, action: EditorAction): Outcome => {
  switch (action.type) {
    case "placeChip": {
      return place(project, action.instance);
    }
    case "moveChip": {
      return move(project, action.instanceId, action.position);
    }
    case "removeChip": {
      return remove(project, action.instanceId);
    }
    default: {
      return assertNever(action);
    }
  }
};

export const editorErrorMessage = (editorError: EditorError): string => {
  switch (editorError.type) {
    case "InstanceNotFound": {
      return m.editor_error_instance_not_found({ instanceId: editorError.instanceId });
    }
    case "DuplicateInstance": {
      return m.editor_error_duplicate_instance({ instanceId: editorError.instanceId });
    }
    case "ProtectedInstance": {
      return m.editor_error_protected_instance();
    }
    default: {
      return assertNever(editorError);
    }
  }
};
