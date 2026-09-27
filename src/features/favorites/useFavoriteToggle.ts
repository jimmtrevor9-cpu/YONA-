import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { addFavorite, favoriteErrorMessage } from "./favorites.functions";
import { myFavoriteIdsQuery } from "./queries";

/**
 * Ajout d'un favori depuis une carte ou un profil : l'étoile se remplit tout de suite,
 * puis l'enregistrement est confirmé par le serveur (retour à l'état précédent en cas
 * d'échec).
 */
export function useFavoriteToggle(userId: string) {
  const queryClient = useQueryClient();
  const add = useServerFn(addFavorite);
  const { queryKey } = myFavoriteIdsQuery(userId);

  const addMutation = useMutation({
    mutationFn: (profileId: string) => add({ data: { profileId } }),
    onMutate: async (profileId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Set<string>>(queryKey);
      queryClient.setQueryData<Set<string>>(queryKey, (ids) => new Set(ids ?? []).add(profileId));
      return { previous };
    },
    onSuccess: () => toast.success("Ajouté à vos favoris."),
    onError: (error, _profileId, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      toast.error(favoriteErrorMessage(error));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["favorites"] }),
  });

  const toggle = (profileId: string, isFavorite: boolean) => {
    if (isFavorite) {
      // Le retrait des favoris est l'étape 8.3.
      toast.info("Le retrait des favoris arrive très bientôt.");
      return;
    }
    addMutation.mutate(profileId);
  };

  return {
    toggle,
    pendingId: addMutation.isPending ? addMutation.variables : null,
  };
}
