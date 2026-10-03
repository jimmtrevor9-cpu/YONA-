import { Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { isSlowConnection } from "@/features/ads/ads";
import { cn } from "@/lib/utils";

/**
 * Média d'une publicité. Vidéo : lecture automatique sans son seulement quand elle est
 * visible, bouton pour activer le son, `preload="metadata"` (rien de lourd téléchargé
 * d'avance), pas de lecture automatique sur une connexion lente : l'interface n'attend
 * jamais la vidéo.
 */
export function AdMedia({
  type,
  src,
  poster,
  className,
  soundButtonClassName,
  showSoundButton = true,
}: {
  type: "image" | "video";
  src: string;
  poster: string | null;
  className?: string;
  soundButtonClassName?: string;
  showSoundButton?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [autoplay] = useState(() => !isSlowConnection());
  const [paused, setPaused] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const v = video.current;
    if (!v || type !== "video" || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (autoplay) void v.play().catch(() => setPaused(true));
        } else {
          v.pause();
        }
      },
      { threshold: [0, 0.5] },
    );
    observer.observe(v);
    return () => observer.disconnect();
  }, [type, autoplay, src]);

  if (type === "image" || failed) {
    const image = type === "image" ? src : poster;
    return image ? (
      <img
        src={image}
        alt=""
        draggable={false}
        className={cn("pointer-events-none object-cover", className)}
      />
    ) : (
      <div className={cn("bg-gradient-to-br from-primary/60 to-gold/60", className)} />
    );
  }

  return (
    <>
      <video
        ref={video}
        src={src}
        poster={poster ?? undefined}
        muted={muted}
        playsInline
        loop
        preload="metadata"
        className={cn("object-cover", className)}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onError={() => setFailed(true)}
        data-testid="ad-video"
      />
      {paused && !autoplay ? (
        <button
          type="button"
          onClick={() => void video.current?.play().catch(() => undefined)}
          className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md"
          aria-label="Lire la vidéo"
        >
          <Play className="size-7" aria-hidden />
        </button>
      ) : null}
      {showSoundButton ? (
        <button
          type="button"
          onClick={() => {
            const v = video.current;
            const next = !muted;
            setMuted(next);
            if (v) {
              v.muted = next;
              if (!next && v.paused) void v.play().catch(() => undefined);
            }
          }}
          className={cn(
            "grid size-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur-md",
            soundButtonClassName,
          )}
          aria-label={muted ? "Activer le son" : "Couper le son"}
          aria-pressed={!muted}
          data-testid="ad-sound"
        >
          {muted ? (
            <VolumeX className="size-5" aria-hidden />
          ) : (
            <Volume2 className="size-5" aria-hidden />
          )}
        </button>
      ) : null}
    </>
  );
}
