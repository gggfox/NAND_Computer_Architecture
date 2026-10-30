// expect-not: boundaries/dependencies
import { greeting } from "../../i18n/messages";
import { sharedValue } from "../util";
import { uiValue } from "./button";

export const uiTotal = sharedValue + uiValue + greeting;
