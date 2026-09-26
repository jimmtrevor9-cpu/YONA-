import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Briefcase, MapPin } from "lucide-react";
import { useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import { matchProfileQuery } from "@/features/matches/queries";
import { computeAge } from "@/features/profiles/queries";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/_authenticated/matches_/$matchId")({
  head: () => ({
    meta: [
      { title: `Profil — ${APP_NAME}` },
      { name: "description", content: "Profil d'une personne avec qui vous avez un Match." },
    ],
  }),
  component: MatchProfilePage,
});

const matchedOn = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Profil de l'autre personne d'un Match. */
function MatchProfilePage() {
  const { matchId } = Route.useParams();
  const { user } = useAuth();
  const [photoIndex, setPhotoIndex] = useState(0);
  const { data, isLoading, isError } = useQuery({
    ...matchProfileQuery(user?.id ?? "", matchId),
    enabled: !!user?.id,
  });

  const name = data?.firstName ?? "Profil";
  const age = computeAge(data?.birthDate ?? null);
  const place = [data?.city, data?.country].filter(Boolean).join(", ");
  const faithRows: [string, string | null | undefined][] = [
    ["Église / dénomination", data?.faith?.denomination],
    ["Fréquentation du culte", data?.faith?.churchAttendance],
    ["Place de la foi dans sa vie", data?.faith?.faithImportance],
    ["Pratique chrétienne", data?.faith?.faithCommitment],
    ["Vie de prière", data?.faith?.prayerPractice],
    ["Vision du mariage", data?.faith?.marriageVision],
  ];
  const filledFaith = faithRows.filter(([, value]) => value);

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader title={data ? name : "Profil"} />
      <main className="mx-auto max-w-md space-y-5 px-5 py-6" data-testid="match-profile">
        <Link
          to="/matches"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Mes Matchs
        </Link>

        {isLoading ? (
          <Skeleton className="h-96 w-full rounded-2xl" />
        ) : isError ? (
          <p className="text-sm text-destructive">
            Ce profil n'a pas pu être chargé. Réessayez dans un instant.
          </p>
        ) : !data ? (
          <div className="panel space-y-4 p-6 text-center" data-testid="match-profile-unavailable">
            <p className="text-sm text-muted-foreground">Ce profil n'est pas disponible.</p>
            <Button asChild size="sm" variant="secondary">
              <Link to="/matches">Retour à mes Matchs</Link>
            </Button>
          </div>
        ) : (
          <>
            {data.photoUrls.length ? (
              <section className="space-y-3" aria-label="Photos">
                <div className="panel gold-thread aspect-[4/5] overflow-hidden">
                  <img
                    src={data.photoUrls[Math.min(photoIndex, data.photoUrls.length - 1)]}
                    alt={`Photo de ${name}`}
                    className="size-full object-cover"
                  />
                </div>
                {data.photoUrls.length > 1 ? (
                  <ul className="grid grid-cols-5 gap-2">
                    {data.photoUrls.map((url, index) => (
                      <li key={url}>
                        <button
                          type="button"
                          onClick={() => setPhotoIndex(index)}
                          aria-label={`Afficher la photo ${index + 1}`}
                          aria-pressed={index === photoIndex}
                          className={`aspect-square w-full overflow-hidden rounded-lg ring-1 ${
                            index === photoIndex ? "ring-gold" : "ring-border"
                          }`}
                        >
                          <img src={url} alt="" className="size-full object-cover" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}

            <section className="panel gold-thread space-y-2 p-5">
              <h2 className="font-display text-2xl font-semibold text-foreground">
                {name}
                {age ? <span className="text-muted-foreground"> · {age} ans</span> : null}
              </h2>
              {place ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="size-3.5" aria-hidden />
                  {place}
                </p>
              ) : null}
              {data.profession ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Briefcase className="size-3.5" aria-hidden />
                  {data.profession}
                </p>
              ) : null}
              <p className="text-[11px] text-muted-foreground">
                Match le {matchedOn.format(new Date(data.matchedAt))}
              </p>
            </section>

            {data.bio ? (
              <section className="panel space-y-2 p-5">
                <p className="eyebrow">Présentation</p>
                <p className="whitespace-pre-line text-sm text-foreground">{data.bio}</p>
              </section>
            ) : null}

            {filledFaith.length || data.faith?.christianValues.length ? (
              <section className="panel space-y-3 p-5">
                <p className="eyebrow">Foi</p>
                {filledFaith.length ? (
                  <dl className="space-y-2">
                    {filledFaith.map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-[11px] text-muted-foreground">{label}</dt>
                        <dd className="text-sm text-foreground">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {data.faith?.christianValues.length ? (
                  <div>
                    <p className="text-[11px] text-muted-foreground">Valeurs chrétiennes</p>
                    <ul className="mt-1.5 flex flex-wrap gap-2">
                      {data.faith.christianValues.map((value) => (
                        <li
                          key={value}
                          className="panel-2 px-2.5 py-1 text-[11px] text-muted-foreground"
                        >
                          {value}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}

            {data.interests.length ? (
              <section className="panel space-y-2 p-5">
                <p className="eyebrow">Centres d'intérêt</p>
                <ul className="flex flex-wrap gap-2">
                  {data.interests.map((interest) => (
                    <li
                      key={interest}
                      className="panel-2 px-2.5 py-1 text-[11px] text-muted-foreground"
                    >
                      {interest}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
