import { Play } from "lucide-react";
import { useRef, useState } from "react";

import { BRAND_VIDEO_POSTER_URL, BRAND_VIDEO_URL } from "@/lib/brand";

/**
 * Vidéo de présentation de la page d'accueil, lue en entier (aucune coupe).
 * - Chargement progressif : seules les premières informations sont lues avant le clic,
 *   puis la vidéo arrive au fil de la lecture (fichier optimisé pour le web).
 * - Lecture dans la page sur téléphone (`playsInline`), format 16:9 qui s'adapte.
 * - Gros bouton de lecture aux couleurs de YONA, puis les commandes du navigateur
 *   (son, plein écran, avance).
 */
export function PresentationVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  function start() {
    const video = videoRef.current;
    if (!video) return;
    setStarted(true);
    void video.play().catch(() => undefined);
  }

  return (
    <div className="absolute inset-0 bg-foreground">
      <video
        ref={videoRef}
        src={BRAND_VIDEO_URL}
        poster={BRAND_VIDEO_POSTER_URL}
        title="Présentation de YONA"
        className="h-full w-full object-contain"
        preload="metadata"
        playsInline
        controls={started}
        onPlay={() => setStarted(true)}
      />
      {!started ? (
        <button
          type="button"
          onClick={start}
          aria-label="Lire la vidéo de présentation"
          className="group absolute inset-0 flex items-center justify-center bg-foreground/10 transition-colors hover:bg-foreground/0"
        >
          <span
            className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-300 group-hover:scale-105 sm:size-20"
            style={{
              boxShadow: "0 18px 40px -16px color-mix(in oklab, var(--primary) 80%, transparent)",
            }}
          >
            <Play className="ml-1 size-7 sm:size-8" aria-hidden />
          </span>
        </button>
      ) : null}
    </div>
  );
}
