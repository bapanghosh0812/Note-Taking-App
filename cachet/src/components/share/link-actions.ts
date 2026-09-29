"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { api, errorMessage, unwrap } from "@/lib/api-client";
import type { ShareResult } from "./share-result-dialog";

/** Owner-side link mutations, shared by the note page and the links manager. */
export function useLinkActions(onKeyIssued: (result: ShareResult) => void) {
  const queryClient = useQueryClient();
  const refresh = (noteId: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["note", noteId] }),
      queryClient.invalidateQueries({ queryKey: ["links"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["notes"] }),
    ]);
  const onError = (e: unknown) => toast.error(errorMessage(e));

  const revoke = useMutation({
    mutationFn: ({ noteId, linkId }: { noteId: string; linkId: string }) =>
      unwrap(api.notes[":id"].links[":linkId"].revoke.$post({ param: { id: noteId, linkId } })),
    onSuccess: async (_r, v) => {
      await refresh(v.noteId);
      toast.success("Link revoked. It stopped working instantly.");
    },
    onError,
  });

  const regenerate = useMutation({
    mutationFn: ({ noteId, linkId }: { noteId: string; linkId: string }) =>
      unwrap(api.notes[":id"].links[":linkId"]["regenerate-key"].$post({ param: { id: noteId, linkId } })),
    onSuccess: async (res, v) => {
      onKeyIssued({ accessKey: res.accessKey, link: res.link, keyOnly: true });
      await refresh(v.noteId);
    },
    onError,
  });

  const extend = useMutation({
    mutationFn: ({ noteId, linkId, expiresAt }: { noteId: string; linkId: string; expiresAt: string }) =>
      unwrap(api.notes[":id"].links[":linkId"].extend.$post({ param: { id: noteId, linkId }, json: { expiresAt } })),
    onSuccess: async (_r, v) => {
      await refresh(v.noteId);
      toast.success("Expiry updated");
    },
    onError,
  });

  return { revoke, regenerate, extend, busy: revoke.isPending || regenerate.isPending || extend.isPending };
}
