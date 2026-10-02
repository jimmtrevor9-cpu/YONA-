import { Check, ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { normalizePlace } from "@/features/geo/geo";
import { cn } from "@/lib/utils";

const MAX_SHOWN = 100;

/**
 * Liste déroulante avec recherche (Pays, Province / région, Ville).
 * Si le lieu cherché n'est pas dans la liste, il peut quand même être choisi tel quel.
 */
export function PlaceSelect({
  id,
  value,
  options,
  placeholder,
  disabled = false,
  loading = false,
  maxLength,
  onChange,
}: {
  id: string;
  value: string;
  options: string[];
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
  maxLength: number;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalizePlace(query);
    const list = q ? options.filter((o) => normalizePlace(o).includes(q)) : options;
    return list.slice(0, MAX_SHOWN);
  }, [options, query]);
  const typed = query.trim().slice(0, maxLength);
  const exact = options.some((o) => normalizePlace(o) === normalizePlace(typed));

  function choose(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          data-testid={`place-${id}`}
          className={cn(
            "flex h-12 w-full items-center justify-between gap-2 rounded-2xl border border-input bg-surface px-4 py-2 text-left text-base transition-colors focus-visible:border-gold/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            value ? "text-foreground" : "text-muted-foreground/70",
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronDown
            aria-hidden
            strokeWidth={2.25}
            className={cn(
              "size-5 shrink-0 text-foreground/70 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) rounded-2xl p-0"
        onOpenAutoFocus={(e) => {
          // Le champ de recherche prend le focus (le clavier s'ouvre sur mobile).
          e.preventDefault();
          (e.currentTarget as HTMLElement).querySelector("input")?.focus();
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            maxLength={maxLength}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const first = filtered[0];
              if (first) choose(first);
              else if (typed) choose(typed);
            }}
            placeholder="Rechercher…"
            aria-label="Rechercher"
            data-testid={`place-${id}-search`}
            className="h-11 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground/70 md:text-sm"
          />
        </div>
        <ul role="listbox" className="max-h-64 overflow-y-auto p-1">
          {loading ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Chargement…</li>
          ) : null}
          {filtered.map((option) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={option === value}
                onClick={() => choose(option)}
                className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
              >
                <span className="truncate">{option}</span>
                {option === value ? <Check aria-hidden className="size-4 text-gold" /> : null}
              </button>
            </li>
          ))}
          {typed && !exact ? (
            <li>
              <button
                type="button"
                onClick={() => choose(typed)}
                className="w-full rounded-xl px-3 py-2 text-left text-sm text-gold hover:bg-accent"
              >
                Utiliser « {typed} »
              </button>
            </li>
          ) : null}
          {!loading && !filtered.length && !typed ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Tape le nom pour l'ajouter.</li>
          ) : null}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
