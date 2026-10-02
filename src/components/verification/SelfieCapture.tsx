import { Camera, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Selfie express : la caméra frontale s'ouvre dans la page, avec un cadre pour placer
 * son visage. Si la caméra n'est pas disponible (refus, navigateur ancien), l'appareil
 * photo du téléphone est proposé à la place.
 */
export function SelfieCapture({
  open,
  onOpenChange,
  pending,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onSend: (image: Blob) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cameraError, setCameraError] = useState(false);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);

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
    if (open && !shot) void startCamera();
    if (!open) stopCamera();
    return stopCamera;
  }, [open, shot, startCamera, stopCamera]);

  useEffect(() => () => (shot ? URL.revokeObjectURL(shot.url) : undefined), [shot]);

  function keep(blob: Blob) {
    stopCamera();
    setShot({ blob, url: URL.createObjectURL(blob) });
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Même sens que l'aperçu (effet miroir).
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => blob && keep(blob), "image/jpeg", 0.9);
  }

  function close(next: boolean) {
    if (!next) setShot(null);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-sm text-center" data-testid="selfie-dialog">
        <DialogHeader className="items-center text-center">
          <DialogTitle className="font-display">Selfie express</DialogTitle>
          <DialogDescription>
            Place ton visage dans le cadre, bien éclairé, sans lunettes de soleil.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mx-auto aspect-[3/4] w-full max-w-xs overflow-hidden rounded-2xl bg-foreground">
          {shot ? (
            <img src={shot.url} alt="Ton selfie" className="h-full w-full object-cover" />
          ) : cameraError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm text-primary-foreground/90">
              <Camera className="size-8" aria-hidden />
              <p>La caméra n'est pas accessible ici. Utilise l'appareil photo de ton téléphone.</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full -scale-x-100 object-cover"
            />
          )}
          {!shot && !cameraError ? (
            <div
              className="pointer-events-none absolute inset-[12%_14%] rounded-[50%] border-2 border-dashed"
              style={{
                borderColor: "color-mix(in oklab, var(--primary-foreground) 85%, transparent)",
              }}
              aria-hidden
            />
          ) : null}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="user"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) keep(file);
            e.target.value = "";
          }}
        />

        <div className="flex flex-col gap-2">
          {shot ? (
            <>
              <Button
                className="h-12 rounded-full"
                disabled={pending}
                onClick={() => onSend(shot.blob)}
                data-testid="selfie-send"
              >
                {pending ? "Envoi…" : "Envoyer mon selfie"}
              </Button>
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => setShot(null)}
                className="gap-2"
              >
                <RefreshCw className="size-4" aria-hidden /> Reprendre
              </Button>
            </>
          ) : cameraError ? (
            <Button className="h-12 rounded-full gap-2" onClick={() => fileRef.current?.click()}>
              <Camera className="size-4" aria-hidden /> Ouvrir l'appareil photo
            </Button>
          ) : (
            <Button className="h-12 rounded-full gap-2" onClick={capture}>
              <Camera className="size-4" aria-hidden /> Prendre la photo
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
