import { Link } from "@tanstack/react-router";
import { Mic, Send, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  VOICE_ERRORS,
  VOICE_MAX_SECONDS,
  formatVoiceDuration,
  pickVoiceMimeType,
  sendVoiceMessage,
  voiceErrorMessage,
} from "@/features/messaging/voice";
import { cn } from "@/lib/utils";

interface VoiceRecorderProps {
  userId: string;
  conversationId: string;
  /** Membre Premium (vérifié par le serveur) : sinon, le bouton mène à la page Premium. */
  premium: boolean;
  onSent: () => void;
}

type RecorderState =
  | { step: "idle" }
  | { step: "recording"; startedAt: number }
  | { step: "ready"; blob: Blob; seconds: number }
  | { step: "sending" };

/** Bouton micro du champ de message : enregistre puis envoie un message vocal (Premium). */
export function VoiceRecorder({ userId, conversationId, premium, onSent }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>({ step: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => stopStream, []);

  // Minuteur pendant l'enregistrement ; arrêt automatique à 2 minutes.
  useEffect(() => {
    if (state.step !== "recording") return;
    const timer = setInterval(() => {
      const seconds = (Date.now() - state.startedAt) / 1000;
      setElapsed(seconds);
      if (seconds >= VOICE_MAX_SECONDS) recorderRef.current?.stop();
    }, 250);
    return () => clearInterval(timer);
  }, [state]);

  if (!premium) {
    return (
      <Button
        asChild
        type="button"
        variant="ghost"
        size="icon"
        className="size-10 shrink-0 rounded-full text-muted-foreground"
      >
        <Link
          to="/premium"
          aria-label="Messages vocaux : réservés aux membres Premium"
          title="Messages vocaux (Premium)"
          data-testid="voice-locked"
        >
          <Mic className="size-4" aria-hidden />
        </Link>
      </Button>
    );
  }

  async function start() {
    const mimeType = pickVoiceMimeType();
    if (!mimeType || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Votre navigateur ne permet pas d'enregistrer un message vocal.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      const startedAt = Date.now();
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stopStream();
        const seconds = Math.min((Date.now() - startedAt) / 1000, VOICE_MAX_SECONDS);
        const blob = new Blob(chunks, { type: mimeType });
        if (seconds < 1 || blob.size === 0) {
          toast.error(VOICE_ERRORS.voice_invalid_duration);
          setState({ step: "idle" });
          return;
        }
        setState({ step: "ready", blob, seconds });
      };
      recorderRef.current = recorder;
      recorder.start(250);
      setElapsed(0);
      setState({ step: "recording", startedAt });
    } catch {
      stopStream();
      toast.error(VOICE_ERRORS.microphone_denied);
    }
  }

  async function send(blob: Blob, seconds: number) {
    setState({ step: "sending" });
    try {
      await sendVoiceMessage({ userId, conversationId, blob, durationSeconds: seconds });
      onSent();
      setState({ step: "idle" });
    } catch (error) {
      toast.error(voiceErrorMessage(error));
      setState({ step: "ready", blob, seconds });
    }
  }

  if (state.step === "idle") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10 shrink-0 rounded-full text-gold"
        aria-label="Enregistrer un message vocal"
        title="Message vocal"
        onClick={() => void start()}
        data-testid="voice-record"
      >
        <Mic className="size-4" aria-hidden />
      </Button>
    );
  }

  const seconds = state.step === "ready" ? state.seconds : elapsed;
  return (
    <div
      className="flex shrink-0 items-center gap-1 rounded-full bg-surface-2 py-1 pl-3 pr-1"
      role="group"
      aria-label="Message vocal"
      data-testid="voice-panel"
    >
      <span
        className={cn(
          "text-xs tabular-nums",
          state.step === "recording" ? "text-destructive" : "text-foreground",
        )}
        aria-live="polite"
        data-testid="voice-timer"
      >
        {state.step === "recording" ? "● " : ""}
        {formatVoiceDuration(seconds)}
      </span>
      {state.step === "recording" ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 rounded-full"
          aria-label="Arrêter l'enregistrement"
          onClick={() => recorderRef.current?.stop()}
        >
          <Square className="size-3.5" aria-hidden />
        </Button>
      ) : null}
      {state.step === "ready" ? (
        <>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 rounded-full"
            aria-label="Supprimer l'enregistrement"
            onClick={() => setState({ step: "idle" })}
          >
            <X className="size-3.5" aria-hidden />
          </Button>
          <Button
            type="button"
            size="icon"
            className="size-8 rounded-full"
            aria-label="Envoyer le message vocal"
            onClick={() => void send(state.blob, state.seconds)}
          >
            <Send className="size-3.5" aria-hidden />
          </Button>
        </>
      ) : null}
      {state.step === "sending" ? (
        <span className="px-2 text-[11px] text-muted-foreground">Envoi…</span>
      ) : null}
    </div>
  );
}
