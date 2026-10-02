import { useState } from "react";

import type { VirtualProfile } from "@/features/virtual-profiles/data";

/** Photo d'un profil d'exemple ; sans photo (ou photo introuvable), un avatar neutre. */
export function VirtualProfilePhoto({
  profile,
  src,
}: {
  profile: VirtualProfile;
  src: string | null;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      data-testid="virtual-profile"
      data-virtual-id={profile.id}
      data-virtual-gender={profile.gender}
      className="relative -mx-5 -mt-5 mb-4 aspect-[4/3] overflow-hidden rounded-t-[inherit] bg-accent"
    >
      {src && !failed ? (
        <img
          src={src}
          alt={`Photo de ${profile.firstName}`}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={`Avatar de ${profile.firstName}`}
          className="flex h-full w-full items-center justify-center"
        >
          <span className="flex size-20 items-center justify-center rounded-full bg-background/70 font-display text-3xl text-accent-foreground">
            {profile.firstName.charAt(0)}
          </span>
        </div>
      )}
      <span className="absolute left-3 top-3 rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-medium text-foreground backdrop-blur">
        Profil d'exemple
      </span>
    </div>
  );
}
