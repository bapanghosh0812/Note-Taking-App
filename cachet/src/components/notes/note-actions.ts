"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { api, errorMessage, unwrap } from "@/lib/api-client";

/** Shared note mutations used by the list, the note page and the trash. */
export function useNoteActions() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const refresh = async (id?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["notes"] }),
      queryClient.invalidateQueries({ queryKey: ["tags"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      id ? queryClient.invalidateQueries({ queryKey: ["note", id] }) : null,
    ]);
  };
  const onError = (e: unknown) => toast.error(errorMessage(e));

  const patch = useMutation({
    mutationFn: ({ id, ...body }: { id: string; pinned?: boolean; archived?: boolean; color?: string; tags?: string[] }) =>
      unwrap(api.notes[":id"].$patch({ param: { id }, json: body as never })),
    onSuccess: (_res, vars) => refresh(vars.id),
    onError,
  });

  const trash = useMutation({
    mutationFn: (id: string) => unwrap(api.notes[":id"].$delete({ param: { id } })),
    onSuccess: async (res, id) => {
      await refresh(id);
      toast.success(res.revokedLinks ? `Moved to trash · ${res.revokedLinks} link${res.revokedLinks === 1 ? "" : "s"} revoked` : "Moved to trash", {
        action: { label: "Undo", onClick: () => restore.mutate(id) },
      });
    },
    onError,
  });

  const restore = useMutation({
    mutationFn: (id: string) => unwrap(api.notes[":id"].restore.$post({ param: { id } })),
    onSuccess: async (_res, id) => {
      await refresh(id);
      toast.success("Note restored");
    },
    onError,
  });

  const destroy = useMutation({
    mutationFn: (id: string) => unwrap(api.notes[":id"].permanent.$delete({ param: { id } })),
    onSuccess: async () => {
      await refresh();
      toast.success("Deleted forever");
    },
    onError,
  });

  const duplicate = useMutation({
    mutationFn: (id: string) => unwrap(api.notes[":id"].duplicate.$post({ param: { id } })),
    onSuccess: async (res) => {
      await refresh();
      toast.success("Duplicated", { action: { label: "Open", onClick: () => router.push(`/notes/${res.note.id}`) } });
    },
    onError,
  });

  return { patch, trash, restore, destroy, duplicate, refresh };
}
