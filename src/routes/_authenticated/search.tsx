import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { ProfileCard } from "@/components/ProfileCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import { discoverProfilesQuery, type Gender } from "@/features/profiles/discovery";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({
    meta: [
      { title: `Recherche — ${APP_NAME}` },
      { name: "description", content: "Recherchez des profils par ville et par genre." },
      { property: "og:title", content: `Recherche — ${APP_NAME}` },
      { property: "og:description", content: "Recherchez des profils par ville et par genre." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { user } = useAuth();
  const [city, setCity] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [filters, setFilters] = useState<{ city?: string; gender?: Gender }>({});

  const { data, isLoading, isError } = useQuery({
    ...discoverProfilesQuery(user?.id ?? "", filters),
    enabled: !!user?.id,
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader title="Recherche" />
      <main className="mx-auto max-w-md space-y-5 px-5 py-6">
        <form
          className="panel gold-thread space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            setFilters({
              ...(city.trim() ? { city: city.trim() } : {}),
              ...(gender ? { gender } : {}),
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="city">Ville</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Libreville"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Je cherche</Label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender | "")}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
            >
              <option value="">Indifférent</option>
              <option value="female">Une femme</option>
              <option value="male">Un homme</option>
            </select>
          </div>
          <Button type="submit" className="w-full">
            Rechercher
          </Button>
        </form>

        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : isError ? (
          <p className="text-sm text-destructive">La recherche a échoué. Réessayez.</p>
        ) : data && data.length > 0 ? (
          <div className="space-y-4">
            {data.map((profile) => (
              <ProfileCard key={profile.user_id} profile={profile} />
            ))}
          </div>
        ) : (
          <div className="panel p-6 text-center">
            <p className="text-sm text-muted-foreground">Aucun profil ne correspond.</p>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
