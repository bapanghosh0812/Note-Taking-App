import { useState } from "react";

/**
 * False until `open` first becomes true, then true for good. Used to mount
 * lazily-loaded dialogs on first use while keeping their close animations.
 */
export function useOpenedOnce(open: boolean) {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened;
}
