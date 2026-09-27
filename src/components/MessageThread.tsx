import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { conversationMessagesQuery } from "@/features/messaging/queries";
import { cn } from "@/lib/utils";

const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function dayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === yesterday.toDateString()) return "Hier";
  const label = dayFormat.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

interface MessageThreadProps {
  userId: string;
  conversationId: string;
  otherName: string;
}

/** Fil des messages d'une conversation (plus anciens en haut, défilement vers le bas). */
export function MessageThread({ userId, conversationId, otherName }: MessageThreadProps) {
  const { data, isLoading, isError } = useQuery({
    ...conversationMessagesQuery(userId, conversationId),
    enabled: !!userId,
  });
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-2/3 rounded-2xl" />
        <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
      </div>
    );
  }
  if (isError) {
    return (
      <p className="text-center text-sm text-destructive">
        Les messages n'ont pas pu être chargés. Réessayez dans un instant.
      </p>
    );
  }
  if (!data?.length) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        Début de votre conversation avec {otherName}.
      </p>
    );
  }

  let previousDay = "";
  return (
    <>
      <ol className="space-y-2" aria-label="Messages">
        {data.map((message) => {
          const date = new Date(message.createdAt);
          const day = date.toDateString();
          const showDay = day !== previousDay;
          previousDay = day;
          return (
            <li key={message.id} className="space-y-2" data-from={message.fromMe ? "me" : "other"}>
              {showDay ? (
                <p className="pt-2 text-center text-[11px] text-muted-foreground">
                  {dayLabel(date)}
                </p>
              ) : null}
              <div className={cn("flex flex-col", message.fromMe ? "items-end" : "items-start")}>
                <p
                  className={cn(
                    "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm",
                    message.fromMe
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "panel-2 rounded-bl-md text-foreground",
                    message.status === "blocked" && "opacity-60",
                  )}
                >
                  <span className="sr-only">{message.fromMe ? "Vous : " : `${otherName} : `}</span>
                  {message.content}
                </p>
                <span className="mt-0.5 text-[10px] text-muted-foreground">
                  <time dateTime={message.createdAt}>{timeFormat.format(date)}</time>
                  {message.status === "blocked" ? (
                    <span className="text-destructive">
                      {" "}
                      · Non envoyé : bloqué par la modération
                    </span>
                  ) : null}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      <div ref={endRef} />
    </>
  );
}
