"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, Eye, ImageUp, Link2, Loader2, NotebookText, Pin, Settings, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { api, errorMessage, unwrap } from "@/lib/api-client";
import { prepareAvatar, uploadAvatar } from "@/lib/avatar-upload";
import { longDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AVATAR_COLORS, LIMITS } from "@/lib/constants";

export function ProfileView() {
  const { data, isLoading } = useQuery({ queryKey: ["account"], queryFn: () => unwrap(api.account.$get()) });
  if (isLoading || !data) return <Skeleton className="h-96 rounded-3xl" />;
  return <ProfileEditor key={data.profile.email} data={data} />;
}

type AccountData = Awaited<ReturnType<typeof unwrap<Awaited<ReturnType<typeof api.account.$get>>>>>;

function ProfileEditor({ data }: { data: AccountData }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile, stats } = data;
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [color, setColor] = useState(profile.avatarColor ?? "gold");
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const dirty = name.trim() !== profile.name || bio.trim() !== (profile.bio ?? "") || color !== (profile.avatarColor ?? "gold");

  const save = useMutation({
    mutationFn: () => unwrap(api.account.$patch({ json: { name: name.trim(), bio: bio.trim(), avatarColor: color as (typeof AVATAR_COLORS)[number] } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      router.refresh();
      toast.success("Profile updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const refreshAvatar = async () => {
    await queryClient.invalidateQueries({ queryKey: ["account"] });
    router.refresh(); // the header and sidebar read the photo from the server layout
  };

  async function onPhotoPicked(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    try {
      await uploadAvatar(await prepareAvatar(file));
      await refreshAvatar();
      toast.success("Profile photo updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const removePhoto = useMutation({
    mutationFn: () => unwrap(api.account.avatar.$delete()),
    onSuccess: async () => {
      await refreshAvatar();
      toast.success("Photo removed");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const statCards = [
    { icon: NotebookText, label: "Notes", value: stats.notes, href: "/notes" },
    { icon: Pin, label: "Pinned", value: stats.pinned, href: "/notes?view=pinned" },
    { icon: Link2, label: "Links created", value: stats.links, href: "/links" },
    { icon: Eye, label: "Total views", value: stats.views, href: "/links" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header card */}
      <section className="hairline bg-card relative overflow-hidden rounded-3xl">
        {/* Solid banner (no opacity): an opacity < 1 would paint it above the avatar and name. */}
        <div className="bg-accent-gradient h-28" />
        <div className="px-6 pb-6">
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="group relative -mt-12 w-fit">
              <UserAvatar name={name || profile.name} color={color} src={profile.avatarUrl} className="ring-card size-24 text-3xl shadow-md ring-4" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={photoBusy}
                aria-label="Change profile photo"
                className="bg-background/90 text-foreground ring-border hover:bg-background absolute right-0 bottom-0 grid size-8 place-items-center rounded-full shadow ring-1 transition-colors"
              >
                {photoBusy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void onPhotoPicked(e.target.files?.[0])} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display truncate text-4xl tracking-tight">{name || profile.name}</h1>
              <p className="text-muted-foreground text-sm">
                {profile.email} · member since {longDate(profile.createdAt)}
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/settings">
                <Settings /> Settings
              </Link>
            </Button>
          </div>
          {(bio || profile.bio) && <p className="mt-4 max-w-2xl text-sm leading-relaxed">{bio || profile.bio}</p>}
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {statCards.map(({ icon: Icon, label, value, href }) => (
          <Link key={label} href={href} className="hairline bg-card hover:ring-gold/40 rounded-2xl p-4 transition-all hover:ring-1">
            <Icon className="text-gold size-4" />
            <p className="mt-3 text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
            <p className="text-muted-foreground text-xs">{label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_18rem]">
        {/* Edit */}
        <section className="hairline bg-card rounded-2xl p-5 sm:p-6">
          <h2 className="font-display text-2xl tracking-tight">Edit profile</h2>
          <form
            className="mt-5 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) save.mutate();
            }}
          >
            <FormField id="name" label="Name">
              <Input id="name" value={name} maxLength={LIMITS.nameMax} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField id="bio" label="Bio" hint={`${bio.length}/160 · a line about you, shown only on this page.`}>
              <textarea
                id="bio"
                value={bio}
                maxLength={160}
                rows={3}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Product designer. Writes things down before forgetting them."
                className="border-input bg-background/40 focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-none rounded-xl border px-3.5 py-2.5 text-sm outline-none focus-visible:ring-3"
              />
            </FormField>
            <div className="space-y-2">
              <p className="text-foreground/85 text-[13px] font-medium">Profile photo</p>
              <div className="flex flex-wrap items-center gap-3">
                <UserAvatar name={name || profile.name} color={color} src={profile.avatarUrl} className="size-12 text-base" />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={photoBusy}>
                  {photoBusy ? <Loader2 className="animate-spin" /> : <ImageUp />} {profile.avatarUrl ? "Change photo" : "Upload photo"}
                </Button>
                {profile.avatarUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removePhoto.mutate()} disabled={removePhoto.isPending} className="hover:text-destructive">
                    <Trash2 /> Remove
                  </Button>
                )}
              </div>
              <p className="text-muted-foreground text-xs">JPEG, PNG or WebP. It’s cropped to a square and resized on your device; location data is removed.</p>
            </div>
            <div className="space-y-2">
              <p className="text-foreground/85 text-[13px] font-medium">Avatar colour {profile.avatarUrl && <span className="text-muted-foreground font-normal">(used when there’s no photo)</span>}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Avatar colour">
                {AVATAR_COLORS.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)} className="relative rounded-full">
                    <UserAvatar name={name || profile.name} color={c} className={cn("size-10 text-xs transition-transform hover:scale-110", color === c && "ring-foreground ring-2 ring-offset-2 ring-offset-[var(--card)]")} />
                    {color === c && <Check className="bg-foreground text-background absolute -right-0.5 -bottom-0.5 size-4 rounded-full p-0.5" />}
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" variant="gold" disabled={!dirty || !name.trim() || save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />} Save profile
            </Button>
          </form>
        </section>

        {/* Security summary */}
        <section className={cn("hairline rounded-2xl p-5", profile.twoFactorEnabled ? "bg-card" : "bg-warning/8 ring-warning/30 ring-1")}>
          {profile.twoFactorEnabled ? <ShieldCheck className="text-success size-6" /> : <ShieldAlert className="text-warning size-6" />}
          <h2 className="mt-3 font-medium">{profile.twoFactorEnabled ? "Two-factor is on" : "Two-factor is off"}</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {profile.twoFactorEnabled ? `${profile.backupCodesRemaining} backup codes left.` : "Add a second step at sign-in to keep your notes safe even if your password leaks."}
          </p>
          <Button asChild variant={profile.twoFactorEnabled ? "outline" : "gold"} size="sm" className="mt-4">
            <Link href="/settings?tab=security">{profile.twoFactorEnabled ? "Manage security" : "Turn on 2FA"}</Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
