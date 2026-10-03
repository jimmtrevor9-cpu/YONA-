import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Briefcase, Church, Crown, MapPin, Sparkles, Users } from "lucide-react";

import { CompatibilityPanel } from "@/components/CompatibilityPanel";
import { PresenceBadge } from "@/components/PresenceBadge";
import { SafetyActions } from "@/components/SafetyActions";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { DEMO_LABEL } from "@/features/profiles/demo";
import type { DiscoverProfile } from "@/features/profiles/discovery";
import { computeAge } from "@/features/profiles/queries";
import { supabase } from "@/integrations/supabase/client";

/** Détails d'un profil de la découverte (lecture soumise aux règles d'accès). */
const profileDetailsQuery = (profile: DiscoverProfile) => ({
  queryKey: ["profiles", "discover-details", profile.user_id],
  queryFn: async () => {
    const [details, faith, photos] = await Promise.all([
      supabase
        .from("profiles")
        .select("profession, marital_status, has_children")
        .eq("user_id", profile.user_id)
        .maybeSingle(),
      supabase
        .from("christian_profiles")
        .select("denomination, church_attendance, prayer_practice, faith_importance")
        .eq("user_id", profile.user_id)
        .maybeSingle(),
      profile.is_virtual
        ? Promise.resolve({ data: [] as { storage_path: string }[], error: null })
        : supabase
            .from("photos")
            .select("storage_path")
            .eq("user_id", profile.user_id)
            .eq("status", "approved")
            .order("is_primary", { ascending: false })
            .order("position"),
    ]);
    let photoUrls: string[] = [];
    if (photos.data?.length) {
      const { data: signed } = await supabase.storage.from("photos").createSignedUrls(
        photos.data.map((p) => p.storage_path),
        60 * 60,
      );
      photoUrls = (signed ?? []).flatMap((s) => (s.signedUrl ? [s.signedUrl] : []));
    }
    return { details: details.data, faith: faith.data, photoUrls };
  },
  staleTime: 60 * 1000,
});

const MARITAL: Record<string, string> = {
  never_married: "Jamais marié(e)",
  divorced: "Divorcé(e)",
  widowed: "Veuf / veuve",
};

/** Fiche détaillée, ouverte en glissant la carte vers le haut. */
export function ProfileDetailsSheet({
  profile,
  viewerId,
  isPremium,
  open,
  onOpenChange,
}: {
  profile: DiscoverProfile | null;
  viewerId: string;
  isPremium: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data } = useQuery({
    ...profileDetailsQuery(profile ?? ({ user_id: "" } as DiscoverProfile)),
    enabled: open && !!profile,
  });
  if (!profile) return null;
  const name = profile.first_name ?? "Profil";
  const age = computeAge(profile.birth_date);
  const photos = data?.photoUrls.length
    ? data.photoUrls
    : profile.photoUrl
      ? [profile.photoUrl]
      : [];
  const faith = data?.faith;
  const facts = [
    data?.details?.profession ? { icon: Briefcase, text: data.details.profession } : null,
    data?.details?.marital_status
      ? { icon: Users, text: MARITAL[data.details.marital_status] ?? data.details.marital_status }
      : null,
    faith?.denomination ? { icon: Church, text: faith.denomination } : null,
  ].filter((f): f is { icon: typeof Briefcase; text: string } => !!f);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent className="max-h-[92dvh]" data-testid="discover-details">
        <div className="mx-auto w-full max-w-md overflow-y-auto px-5 pb-10 pt-4">
          {photos.length ? (
            <div className="-mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-3">
              {photos.map((url) => (
                <img
                  key={url}
                  src={url}
                  alt={`Photo de ${name}`}
                  className="aspect-[3/4] w-[78%] shrink-0 snap-center rounded-2xl object-cover"
                />
              ))}
            </div>
          ) : null}
          <DrawerTitle className="flex flex-wrap items-center gap-2 font-display text-2xl font-semibold text-foreground">
            {name}
            {age ? <span className="font-normal text-muted-foreground">{age} ans</span> : null}
            {profile.is_verified ? (
              <BadgeCheck
                className="size-6 fill-success text-white"
                aria-label="Identité vérifiée"
              />
            ) : null}
            {isPremium ? <Crown className="size-5 text-gold" aria-label="Membre Premium" /> : null}
          </DrawerTitle>
          <DrawerDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {profile.city || profile.country ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4" aria-hidden />
                {[profile.city, profile.region, profile.country].filter(Boolean).join(", ")}
                {profile.distance_km !== null ? ` · à ${profile.distance_km} km` : ""}
              </span>
            ) : null}
            {profile.relationship_goal ? (
              <span className="inline-flex items-center gap-1">
                <Users className="size-4" aria-hidden />
                {profile.relationship_goal}
              </span>
            ) : null}
          </DrawerDescription>
          {profile.is_virtual ? (
            <p className="mt-3 flex gap-2 rounded-xl bg-gold/10 p-3 text-xs text-gold">
              <Sparkles className="size-4 shrink-0" aria-hidden />
              <span>
                <strong>{DEMO_LABEL}</strong> : ce n'est pas un membre. Il montre comment fonctionne
                YONA pendant le lancement ; il ne peut ni écrire ni répondre.
              </span>
            </p>
          ) : (
            <PresenceBadge userId={profile.user_id} className="mt-2" />
          )}
          {profile.bio ? (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-foreground">
              {profile.bio}
            </p>
          ) : null}
          {facts.length ? (
            <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              {facts.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2">
                  <Icon className="size-4 shrink-0 text-gold" aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
          ) : null}
          {faith && (faith.church_attendance || faith.prayer_practice || faith.faith_importance) ? (
            <dl className="mt-4 grid grid-cols-1 gap-2 rounded-2xl bg-surface-2 p-3 text-xs sm:grid-cols-3">
              {faith.church_attendance ? (
                <div>
                  <dt className="text-muted-foreground">Église</dt>
                  <dd className="text-foreground">{faith.church_attendance}</dd>
                </div>
              ) : null}
              {faith.prayer_practice ? (
                <div>
                  <dt className="text-muted-foreground">Prière</dt>
                  <dd className="text-foreground">{faith.prayer_practice}</dd>
                </div>
              ) : null}
              {faith.faith_importance ? (
                <div>
                  <dt className="text-muted-foreground">Place de la foi</dt>
                  <dd className="text-foreground">{faith.faith_importance}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          {profile.interests?.length ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {profile.interests.map((interest) => (
                <li key={interest} className="panel-2 px-2.5 py-1 text-xs text-muted-foreground">
                  {interest}
                </li>
              ))}
            </ul>
          ) : null}
          {!profile.is_virtual && viewerId ? (
            <>
              <div className="mt-5">
                <CompatibilityPanel userId={viewerId} otherId={profile.user_id} />
              </div>
              <div className="mt-5">
                <SafetyActions userId={profile.user_id} name={name} />
              </div>
            </>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
