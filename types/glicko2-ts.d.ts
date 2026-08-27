/**
 * `glicko2.ts` ships its types at `dist/index.d.ts`, but the `exports` map in
 * its package.json has no `types` condition — only `import`, `require` and
 * `default`, all pointing at JavaScript. Modern TypeScript resolution respects
 * `exports`, follows it to `dist/index.mjs`, looks for the `index.d.mts` that
 * would sit beside it, and finds nothing:
 *
 *   TS7016: Could not find a declaration file for module 'glicko2.ts'.
 *   There are types at '…/dist/index.d.ts', but this result could not be
 *   resolved when respecting package.json "exports".
 *
 * So point at them by hand. This re-exports the package's own declarations
 * rather than restating them, so the types stay whatever the package says they
 * are — nothing here has to be maintained when it updates.
 *
 * Both TypeScript projects need it: the room is checked by the Colyseus
 * tsconfig and the rating scripts by the Next one, so this lives at the root
 * and the Colyseus tsconfig names it in `include`.
 */
declare module "glicko2.ts" {
	// `import(...)` in type position resolves like an ordinary relative import,
	// which `export * from "…"` inside an ambient module does not.
	type Package = typeof import("../node_modules/glicko2.ts/dist/index");

	export const Glicko2: Package["Glicko2"];
	export const newProcedure: Package["newProcedure"];
	export const oldProcedure: Package["oldProcedure"];
	export type Player = InstanceType<Package["Player"]>;
}
