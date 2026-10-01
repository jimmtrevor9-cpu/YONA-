import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { getRecentSignups } from "@/features/auth/recent-signups.functions";

/**
 * Petite bulle « Marie (Cameroun) vient de s'inscrire », alimentée par les vrais derniers
 * inscrits visibles (prénom et pays seulement). Rien n'est affiché s'il n'y en a aucun.
 */
export function RecentSignups() {
  const { data } = useQuery({
    queryKey: ["recent-signups"],
    queryFn: () => getRecentSignups(),
    staleTime: 60_000,
  });
  const [index, setIndex] = useState(0);
  const list = data ?? [];

  useEffect(() => {
    if (list.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % list.length), 4000);
    return () => window.clearInterval(timer);
  }, [list.length]);

  const item = list[index % Math.max(list.length, 1)];
  if (!item) return null;
  return (
    <div
      key={index}
      data-testid="recent-signup"
      className="animate-rise inline-flex items-center gap-2 rounded-full bg-background/85 px-3 py-1.5 text-xs text-foreground shadow backdrop-blur"
    >
      <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
      <span>
        <strong>{item.first_name}</strong>
        {item.country ? ` (${item.country})` : ""} vient de s'inscrire
      </span>
    </div>
  );
}
