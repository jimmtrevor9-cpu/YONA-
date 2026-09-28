import { useQuery } from "@tanstack/react-query";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SEARCH_TEXT_MAX_LENGTH } from "@/features/search/filters";
import { searchValuesQuery, type SearchValueField } from "@/features/search/queries";

interface SearchTextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Suggestions tirées des valeurs réellement renseignées (champs publics seulement). */
  suggestionsFor?: SearchValueField;
  userId: string;
}

/** Critère texte de la recherche (« contient »), avec suggestions éventuelles. */
export function SearchTextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  suggestionsFor,
  userId,
}: SearchTextFieldProps) {
  const { data: suggestions } = useQuery({
    ...searchValuesQuery(userId, suggestionsFor ?? "denomination"),
    enabled: !!userId && !!suggestionsFor,
  });
  const listId = suggestionsFor ? `${id}-suggestions` : undefined;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        list={listId}
        autoComplete="off"
        maxLength={SEARCH_TEXT_MAX_LENGTH}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {listId ? (
        <datalist id={listId} data-testid={listId}>
          {(suggestions ?? []).map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      ) : null}
    </div>
  );
}
