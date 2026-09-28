import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { ProfileCard } from "@/components/ProfileCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import type { Gender } from "@/features/profiles/discovery";
import {
  EMPTY_SEARCH_FORM,
  SEARCH_MAX_AGE,
  SEARCH_MIN_AGE,
  SEARCH_PLACE_MAX_LENGTH,
  buildSearchFilters,
  type SearchFilters,
  type SearchForm,
} from "@/features/search/filters";
import {
  searchCountriesQuery,
  searchDefaultsQuery,
  searchProfilesQuery,
} from "@/features/search/queries";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({
    meta: [
      { title: `Recherche — ${APP_NAME}` },
      { name: "description", content: "Recherchez des profils selon vos critères." },
      { property: "og:title", content: `Recherche — ${APP_NAME}` },
      { property: "og:description", content: "Recherchez des profils selon vos critères." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<SearchForm>(EMPTY_SEARCH_FORM);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [formError, setFormError] = useState<string | null>(null);
  const update = <K extends keyof SearchForm>(key: K, value: SearchForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  // Sexe recherché : part des préférences enregistrées (modifiable, « Indifférent » possible).
  const { data: defaults, isLoading: defaultsLoading } = useQuery({
    ...searchDefaultsQuery(user?.id ?? ""),
    enabled: !!user?.id,
  });
  const defaultsApplied = useRef(false);
  useEffect(() => {
    if (!defaults || defaultsApplied.current) return;
    defaultsApplied.current = true;
    if (!defaults.gender) return;
    const gender = defaults.gender;
    setForm((current) => ({ ...current, gender }));
    setFilters((current) => ({ ...current, gender }));
  }, [defaults]);

  const { data: countries } = useQuery({
    ...searchCountriesQuery(user?.id ?? ""),
    enabled: !!user?.id,
  });

  const { data, isLoading, isError } = useQuery({
    ...searchProfilesQuery(user?.id ?? "", filters),
    enabled: !!user?.id && !defaultsLoading,
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader title="Recherche" />
      <main className="mx-auto max-w-md space-y-5 px-5 py-6">
        <form
          className="panel gold-thread space-y-4 p-5"
          data-testid="search-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const result = buildSearchFilters(form);
            if (result.error !== undefined) {
              setFormError(result.error);
              return;
            }
            setFormError(null);
            setFilters(result.filters);
          }}
        >
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Âge</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="minAge" className="text-xs text-muted-foreground">
                  De (ans)
                </Label>
                <Input
                  id="minAge"
                  inputMode="numeric"
                  min={SEARCH_MIN_AGE}
                  max={SEARCH_MAX_AGE}
                  value={form.minAge}
                  onChange={(e) => update("minAge", e.target.value)}
                  placeholder={String(SEARCH_MIN_AGE)}
                  aria-invalid={!!formError}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="maxAge" className="text-xs text-muted-foreground">
                  À (ans)
                </Label>
                <Input
                  id="maxAge"
                  inputMode="numeric"
                  min={SEARCH_MIN_AGE}
                  max={SEARCH_MAX_AGE}
                  value={form.maxAge}
                  onChange={(e) => update("maxAge", e.target.value)}
                  placeholder={String(SEARCH_MAX_AGE)}
                  aria-invalid={!!formError}
                />
              </div>
            </div>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="country">Pays</Label>
            <Input
              id="country"
              list="search-countries"
              autoComplete="off"
              maxLength={SEARCH_PLACE_MAX_LENGTH}
              value={form.country}
              onChange={(e) => update("country", e.target.value)}
              placeholder="Tous les pays"
            />
            <datalist id="search-countries" data-testid="search-countries">
              {(countries ?? []).map((country) => (
                <option key={country} value={country} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Ville</Label>
            <Input
              id="city"
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
              placeholder="Libreville"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Sexe — je cherche</Label>
            <select
              id="gender"
              value={form.gender}
              onChange={(e) => update("gender", e.target.value as Gender | "")}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
            >
              <option value="">Indifférent</option>
              <option value="female">Une femme</option>
              <option value="male">Un homme</option>
            </select>
          </div>
          {formError ? (
            <p className="text-sm text-destructive" role="alert" data-testid="search-error">
              {formError}
            </p>
          ) : null}
          <Button type="submit" className="w-full">
            Rechercher
          </Button>
        </form>

        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : isError ? (
          <p className="text-sm text-destructive">La recherche a échoué. Réessayez.</p>
        ) : data && data.length > 0 ? (
          <div className="space-y-4" data-testid="search-results">
            {data.map((profile) => (
              <ProfileCard key={profile.user_id} profile={profile} />
            ))}
          </div>
        ) : (
          <div className="panel p-6 text-center" data-testid="search-empty">
            <p className="text-sm text-muted-foreground">Aucun profil ne correspond.</p>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
