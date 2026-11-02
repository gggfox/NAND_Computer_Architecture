import { useFocusVisible } from "react-aria";

/**
 * Whether the user is working without a pointer: from the keyboard, or through assistive
 * technology (React Aria's "keyboard" and "virtual" modalities). Kept current as they switch.
 * `react-aria` exports the raw modality only from a private path, so this reads the public
 * focus-visible state, which is the same test.
 */
export const useKeyboardModality = (): boolean => useFocusVisible().isFocusVisible;
