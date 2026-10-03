import { ArrowLeft, ArrowRight, Camera, ScanFace } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { captureFrame } from "@/features/verification/client";

/**
 * Tâche F — Selfie en direct avec consigne (vivacité minimale) : la caméra frontale
 * s'ouvre dans la page (aucune photo de la galerie), une 1re photo de face, puis une
 * consigne tirée au hasard par le serveur (« tourne la tête vers la gauche / la droite »)
 * et une 2e photo prise automatiquement. Le serveur vérifie que c'est la même personne et
 * que la tête a tourné du bon côté : une photo imprimée ou une capture d'écran ne suffit pas.
 */
type Phase = "front" | "turn" | "done";

export function LiveSelfieCapture({
  open,
  challenge,
  pending,
  onOpenChange,
  onCaptured,
}: {
  open: boolean;
  challenge: "turn_left" | "turn_right";
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onCaptured: (images: { front: Blob; turned: Blob }) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frontRef = useRef<Blob | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [phase, setPhase] = useState<Phase>("front");
  const [countdown, setCountdown] = useState(3);
  // Fonction du parent gardée à part : le compte à rebours ne redémarre pas à chaque rendu.
  const onCapturedRef = useRef(onCaptured);
  onCapturedRef.current = onCaptured;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch {
      setCameraError(true);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setPhase("front");
      frontRef.current = null;
      void startCamera();
    } else stopCamera();
    return stopCamera;
  }, [open, startCamera, stopCamera]);

  // Consigne affichée : compte à rebours, puis 2e photo prise automatiquement.
  useEffect(() => {
    if (phase !== "turn") return;
    setCountdown(3);
    let left = 3;
    const id = window.setInterval(() => {
      left -= 1;
      setCountdown(left);
      if (left > 0) return;
      window.clearInterval(id);
      const video = videoRef.current;
      const front = frontRef.current;
      if (!video || !front) return;
      void captureFrame(video).then((turned) => {
        setPhase("done");
        stopCamera();
        onCapturedRef.current({ front, turned });
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, stopCamera]);

  async function takeFront() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    frontRef.current = await captureFrame(video);
    setPhase("turn");
  }

  const left = challenge === "turn_left";
  const Arrow = left ? ArrowLeft : ArrowRight;

  return (
    <Dialog open={open} onOpenChange={(next) => (!pending ? onOpenChange(next) : undefined)}>
      <DialogContent className="max-w-sm text-center" data-testid="live-selfie-dialog">
        <DialogHeader className="items-center text-center">
          <DialogTitle className="font-display">Selfie en direct</DialogTitle>
          <DialogDescription>
            {phase === "front"
              ? "Visage dans l'ovale, bien éclairé, sans lunettes de soleil. Regarde l'objectif."
              : phase === "turn"
                ? `Tourne lentement la tête vers la ${left ? "gauche" : "droite"}.`
                : "Analyse de ton visage…"}
          </DialogDescription>
        </DialogHeader>

        <div className="relative mx-auto aspect-[3/4] w-full max-w-xs overflow-hidden rounded-2xl bg-foreground">
          {cameraError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm text-primary-foreground/90">
              <Camera className="size-8" aria-hidden />
              <p>
                La caméra n'est pas accessible. Autorise la caméra dans ton navigateur, ou choisis
                la vérification par pièce d'identité. (Les photos de la galerie ne sont pas
                acceptées pour le selfie.)
              </p>
            </div>
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full -scale-x-100 object-cover"
              data-testid="live-selfie-video"
            />
          )}
          {!cameraError ? (
            <div
              className="pointer-events-none absolute inset-[12%_14%] rounded-[50%] border-2 border-dashed"
              style={{
                borderColor: "color-mix(in oklab, var(--primary-foreground) 85%, transparent)",
              }}
              aria-hidden
            />
          ) : null}
          {phase === "turn" ? (
            <div
              className="absolute inset-x-0 bottom-4 flex flex-col items-center gap-1 text-primary-foreground"
              aria-live="assertive"
              data-testid="live-selfie-challenge"
            >
              <span className="flex items-center gap-2 rounded-full bg-black/55 px-4 py-2 text-base font-semibold backdrop-blur-md">
                {left ? <Arrow className="size-6" aria-hidden /> : null}
                Tourne la tête à {left ? "gauche" : "droite"}
                {!left ? <Arrow className="size-6" aria-hidden /> : null}
              </span>
              <span
                className="text-3xl font-bold tabular-nums"
                aria-label={`${countdown} secondes`}
              >
                {countdown}
              </span>
            </div>
          ) : null}
          {phase === "done" ? (
            <div className="absolute inset-0 grid place-items-center bg-black/55 text-primary-foreground">
              <ScanFace className="size-10 animate-pulse" aria-hidden />
            </div>
          ) : null}
        </div>

        {phase === "front" && !cameraError ? (
          <Button
            className="h-12 gap-2 rounded-full"
            onClick={() => void takeFront()}
            data-testid="live-selfie-take"
          >
            <Camera className="size-4" aria-hidden /> Prendre la photo
          </Button>
        ) : null}
        {cameraError ? (
          <Button
            variant="outline"
            className="h-12 rounded-full"
            onClick={() => void startCamera()}
          >
            Réessayer la caméra
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
