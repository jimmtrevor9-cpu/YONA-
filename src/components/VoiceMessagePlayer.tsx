import { useQuery } from "@tanstack/react-query";
import { Mic } from "lucide-react";

import { formatVoiceDuration, voiceMessageUrl } from "@/features/messaging/voice";

/** Lecture d'un message vocal (lien temporaire vers le stockage privé). */
export function VoiceMessagePlayer({
  path,
  durationSeconds,
}: {
  path: string;
  durationSeconds: number;
}) {
  const { data: url, isLoading } = useQuery({
    queryKey: ["voice", path],
    queryFn: () => voiceMessageUrl(path),
    staleTime: 50 * 60 * 1000,
  });
  return (
    <span className="flex flex-col gap-1" data-testid="voice-message">
      <span className="flex items-center gap-1.5 text-xs">
        <Mic className="size-3.5" aria-hidden />
        Message vocal · {formatVoiceDuration(durationSeconds)}
      </span>
      {url ? (
        <audio controls preload="none" src={url} className="h-9 w-56 max-w-full">
          <track kind="captions" />
        </audio>
      ) : (
        <span className="text-[11px] opacity-80">
          {isLoading ? "Chargement…" : "Écoute indisponible."}
        </span>
      )}
    </span>
  );
}
