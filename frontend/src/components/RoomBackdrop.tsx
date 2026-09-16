import type { MutableRefObject } from "react";
import { AvatarScene, type AvatarFraming, type AvatarState } from "./AvatarScene";
import { AvatarSpeechBubble } from "./AvatarSpeechBubble";
import type { AvatarType } from "../types";

type Props = {
  /** Room.backgroundImageSrc from the API - null renders a plain gradient fallback instead of a broken image (no room artwork exists yet for the V2 pilot). */
  backgroundImageSrc: string | null;
  /** Shown over the gradient fallback only - never rendered once a real backgroundImageSrc is set. */
  roomTitle: string;
  avatarState: AvatarState;
  avatarType: AvatarType;
  speechText: string | null;
  charIndexRef: MutableRefObject<number | null>;
  onReady: () => void;
  framing?: AvatarFraming;
  heightClassName?: string;
};

/**
 * Generalizes the "photo backdrop + transparent-background avatar" pattern
 * already used ad hoc by DashboardPage's classroom intro and
 * PlacementTestPage (each with its own slightly different CSS technique) -
 * the V2 pilot's Room/Mission screens are the third and fourth callers, so
 * this is now the one shared implementation instead of a third copy-paste.
 */
export function RoomBackdrop({
  backgroundImageSrc,
  roomTitle,
  avatarState,
  avatarType,
  speechText,
  charIndexRef,
  onReady,
  framing = "portrait",
  heightClassName = "h-[320px] sm:h-[420px]",
}: Props) {
  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden flex items-end justify-center ${heightClassName}`}
      style={
        backgroundImageSrc
          ? {
              backgroundImage: `linear-gradient(180deg, rgba(8,12,24,0.15) 0%, rgba(8,12,24,0.55) 100%), url(${backgroundImageSrc})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {!backgroundImageSrc && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-slate-800 to-slate-950 flex items-center justify-center"
        >
          <span className="text-6xl opacity-20">🏠</span>
          <span className="absolute bottom-3 text-xs text-slate-500 uppercase tracking-wide">{roomTitle}</span>
        </div>
      )}

      <div className="relative w-full max-w-xs mt-16">
        <AvatarScene
          state={avatarState}
          avatarType={avatarType}
          speechText={speechText}
          charIndexRef={charIndexRef}
          onReady={onReady}
          framing={framing}
          transparentBackground
          showStateLabel={false}
          heightClassName="h-full min-h-[260px]"
        />
        <AvatarSpeechBubble text={speechText} active={avatarState === "speaking"} charIndexRef={charIndexRef} />
      </div>
    </div>
  );
}
