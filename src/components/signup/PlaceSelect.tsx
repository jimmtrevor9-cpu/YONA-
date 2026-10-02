import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { normalizePlace } from "@/features/profiles/geo";
import { cn } from "@/lib/utils";

const MAX_VISIBLE = 150;

/**
 * Liste déroulante avec recherche (pays, région ou ville).
 * - Flèche discrète en bas à droite de la case.
 * - Recherche sans accents ni majuscules ; liste rapide même avec des milliers de noms.
 * - `allowCustom` : si le nom cherché n'existe pas, il peut être utilisé tel quel.
 */
export function PlaceSelect({
  id,
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  loading,
  allowCustom,
  maxLength,
}: {
  id: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
  loading?: boolean;
  allowCustom?: boolean;
  maxLength?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const indexed = useMemo(
    () => options.map((name) => ({ name, key: normalizePlace(name) })),
    [options],
  );
  const filtered = useMemo(() => {
    const q = normalizePlace(query);
    if (!q) return indexed;
    const starts = indexed.filter((o) => o.key.startsWith(q));
    const contains = indexed.filter((o) => !o.key.startsWith(q) && o.key.includes(q));
    return [...starts, ...contains];
  }, [indexed, query]);
  const visible = filtered.slice(0, MAX_VISIBLE);
  const custom = query.trim().slice(0, maxLength ?? 100);
  const showCustom =
    allowCustom && custom.length > 0 && !filtered.some((o) => o.key === normalizePlace(custom));

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [query]);

  function choose(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "relative flex h-11 w-full items-center rounded-md border border-input bg-transparent pl-3 pr-10 text-left text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            open && "border-gold/60",
          )}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {loading ? "Chargement…" : value || placeholder}
          </span>
          <ChevronDown
            className={cn(
              "pointer-events-none absolute bottom-2.5 right-3 h-4 w-4 text-gold transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl p-0"
        onOpenAutoFocus={(event) => {
          // Sur téléphone, on n'ouvre pas le clavier tout de suite : la liste se lit d'abord.
          if (window.matchMedia("(pointer: coarse)").matches) event.preventDefault();
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (visible[0]) choose(visible[0].name);
              else if (showCustom) choose(custom);
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-11 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
          />
        </div>
        <div
          ref={listRef}
          role="listbox"
          className="max-h-72 overflow-y-auto overscroll-contain p-1"
        >
          {showCustom ? (
            <button
              type="button"
              onClick={() => choose(custom)}
              className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm text-foreground hover:bg-accent"
            >
              Utiliser « {custom} »
            </button>
          ) : null}
          {visible.map((o) => (
            <button
              key={o.name}
              type="button"
              role="option"
              aria-selected={o.name === value}
              onClick={() => choose(o.name)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-foreground hover:bg-accent",
                o.name === value && "bg-accent font-medium",
              )}
            >
              <span className="truncate">{o.name}</span>
              {o.name === value ? <Check className="h-4 w-4 shrink-0 text-gold" /> : null}
            </button>
          ))}
          {filtered.length > MAX_VISIBLE ? (
            <p className="px-3 py-2 text-center text-xs text-muted-foreground">
              Tape quelques lettres pour voir les {filtered.length - MAX_VISIBLE} autres.
            </p>
          ) : null}
          {filtered.length === 0 && !showCustom ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
