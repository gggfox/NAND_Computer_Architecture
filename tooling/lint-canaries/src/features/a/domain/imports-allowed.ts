// expect-not: boundaries/dependencies
import { internalValue } from "../../b";
import { greeting } from "../../../i18n/messages";
import { sharedValue } from "../../../shared/util";
import { uiValue } from "../../../shared/ui/button";

export const featureTotal = internalValue + sharedValue + uiValue + greeting;
