import { queryOptions } from "@tanstack/react-query";

import { adminErrorMessage } from "@/features/admin/admin.functions";
import { supabase } from "@/integrations/supabase/client";

/** Tâche E — Localisation d'un membre vue par l'administration. */
export interface AdminUserLocation {
  current: {
    source: string;
    country_code: string | null;
    country: string | null;
    region: string | null;
    city: string | null;
    latitude: number;
    longitude: number;
    accuracy_m: number | null;
    ip_country: string | null;
    ip_city: string | null;
    timezone: string | null;
    language: string | null;
    inconsistent: boolean;
    inconsistency: string[];
    updated_at: string;
    checked_at: string | null;
  } | null;
  declared: { country: string | null; region: string | null; city: string | null } | null;
  history: {
    id: number;
    source: string;
    retained_source: string;
    country: string | null;
    city: string | null;
    ip_country: string | null;
    timezone: string | null;
    inconsistent: boolean;
    inconsistency: string[];
    created_at: string;
  }[];
}

export const adminUserLocationQuery = (userId: string) =>
  queryOptions({
    queryKey: ["admin", "location", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_user_location", { _user_id: userId });
      if (error) throw new Error(adminErrorMessage(error.message));
      return data as unknown as AdminUserLocation;
    },
  });
