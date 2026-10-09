// The last piece taken off the stage while showing, e.g. by going to another screen: if the next
// screen shows it again soon, it carries on as it was, without fading in.
let lastLeft: { fadeKey: string; at: number } | null = null;
const CARRY_ON = 1500;
export const carriesOn = (fadeKey: string) =>
  lastLeft?.fadeKey === fadeKey && performance.now() - lastLeft.at < CARRY_ON;

/**
 * The piece of this performance that was just on the stage, if any (its `fadeKey` is
 * `performanceId:pieceKey`), so the next screen can start on it.
 */
export function pieceJustShown(performanceId: string) {
  if (!lastLeft || performance.now() - lastLeft.at >= CARRY_ON) return null;
  const [id, key] = lastLeft.fadeKey.split(':');
  return id === performanceId && key ? key : null;
}

/** Notes that a piece left the stage while showing. */
export function leftStage(fadeKey: string) {
  lastLeft = { fadeKey, at: performance.now() };
}

// When the turn of the piece on show began in a carousel, so the next screen's carousel carries on
// from the same second instead of starting the turn again.
let turn: { fadeKey: string; startedAt: number } | null = null;

/** Notes that a piece (by its `fadeKey`) has just begun its turn; null when none is running. */
export function noteTurn(fadeKey: string | null) {
  turn = fadeKey ? { fadeKey, startedAt: performance.now() } : null;
}

/** How long the piece just shown had been on its turn, in ms; 0 if it was not taking turns. */
export function turnElapsed(fadeKey: string) {
  return turn?.fadeKey === fadeKey && carriesOn(fadeKey) ? performance.now() - turn.startedAt : 0;
}
