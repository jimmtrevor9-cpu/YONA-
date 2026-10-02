import { BRAND_LOGO_URL } from "@/lib/brand";

/** Petit écran de chargement élégant, affiché pendant une redirection automatique. */
export function RedirectingScreen({
  message,
  detail,
}: {
  message: string;
  detail?: string | undefined;
}) {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-background px-5"
      data-testid="redirecting"
    >
      <div className="gold-halo flex flex-col items-center text-center" role="status">
        <div className="relative grid size-24 place-items-center">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-gold/20 border-t-gold [animation-duration:1.1s]" />
          <img
            src={BRAND_LOGO_URL}
            alt=""
            width={64}
            height={64}
            className="size-16 animate-pulse object-contain"
          />
        </div>
        <p className="mt-6 font-display text-xl font-semibold text-foreground">{message}</p>
        {detail ? <p className="mt-2 text-sm text-muted-foreground">{detail}</p> : null}
      </div>
    </main>
  );
}
