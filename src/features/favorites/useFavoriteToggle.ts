import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { addFavorite, favoriteErrorMessage, removeFavorite } from "./favorites.functions";
import { myFavoriteIdsQuery } from "./queries";

type ToggleVariables = { profileId: string; favorite: boolean };

/**
 * Ajout ou retrait d'un favori depuis une carte ou un profil : l'étoile change tout de
 * suite, puis le changement est confirmé par le serveur (retour à l'état précédent en
 * cas d'échec).
 */
export function useFavoriteToggle(userId: string) {
  const queryClient = useQueryClient();
  const add = useServerFn(addFavorite);
  const remove = useServerFn(removeFavorite);
  const { queryKey } = myFavoriteIdsQuery(userId);

  const mutation = useMutation({
    // `changed` vaut false si l'état était déjà le bon côté serveur (autre onglet, double
    // clic) : rien n'est écrit deux fois.
    mutationFn: async ({ profileId, favorite }: ToggleVariables): Promise<boolean> => {
      if (favorite) return !(await add({ data: { profileId } })).alreadyFavorite;
      return (await remove({ data: { profileId } })).wasFavorite;
    },
    onMutate: async ({ profileId, favorite }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Set<string>>(queryKey);
      queryClient.setQueryData<Set<string>>(queryKey, (ids) => {
        const next = new Set(ids ?? []);
        if (favorite) next.add(profileId);
        else next.delete(profileId);
        return next;
      });
      return { previous };
    },
    onSuccess: (changed, { favorite }) => {
      if (!changed)
        toast.info(
          favorite
            ? "Ce profil est déjà dans vos favoris."
            : "Ce profil n'était déjà plus dans vos favoris.",
        );
      else toast.success(favorite ? "Ajouté à vos favoris." : "Retiré de vos favoris.");
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      toast.error(favoriteErrorMessage(error));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["favorites"] }),
  });

  const toggle = (profileId: string, isFavorite: boolean) =>
    mutation.mutate({ profileId, favorite: !isFavorite });

  return {
    toggle,
    pendingId: mutation.isPending ? mutation.variables?.profileId : null,
  };
}
