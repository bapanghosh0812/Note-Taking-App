import type { toast as sonnerToast } from "sonner";

/**
 * `toast.success / error / info` without putting the toast library in every
 * page's initial JavaScript: sonner is fetched on first use (the <Toaster>
 * itself is lazy-loaded in components/providers.tsx).
 */
type Message = Parameters<typeof sonnerToast.success>[0];
type Options = Parameters<typeof sonnerToast.success>[1];

const load = () => import("sonner").then((m) => m.toast);

export const toast = {
  success: (message: Message, options?: Options) => void load().then((t) => t.success(message, options)),
  error: (message: Message, options?: Options) => void load().then((t) => t.error(message, options)),
  info: (message: Message, options?: Options) => void load().then((t) => t.info(message, options)),
};
