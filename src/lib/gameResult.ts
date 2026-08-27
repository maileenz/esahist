import type { Color, GameResult } from "./protocol";

export type Outcome = "win" | "loss" | "draw" | "aborted";

/** A PGN result token read from one player's side of the board. */
export function outcomeFor(
	result: GameResult | string | null,
	color: Color,
): Outcome {
	if (result === "1/2-1/2") return "draw";
	if (result === "1-0") return color === "w" ? "win" : "loss";
	if (result === "0-1") return color === "w" ? "loss" : "win";
	return "aborted";
}
