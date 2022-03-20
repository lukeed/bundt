// @see https://github.com/lukeed/kleur/
let { FORCE_COLOR, NODE_DISABLE_COLORS, NO_COLOR, TERM } = process.env;
let isTTY = process.stdout && process.stdout.isTTY || true;

let enabled = !NODE_DISABLE_COLORS && NO_COLOR == null && TERM !== 'dumb' && (
	FORCE_COLOR != null && FORCE_COLOR !== '0' || isTTY
);

export const disable = () => enabled = false;

type Color = (msg: string) => string;

// bold dim italic underline
export const input: Color = x => enabled ? `\x1b[1m\x1b[2m\x1b[3m\x1b[4m${x}\x1b[0m` : x;

// bold dim italic
export const th: Color = x => enabled ? `\x1b[1m\x1b[2m\x1b[3m${x}\x1b[0m` : x;

// dim italic
export const gzip: Color = x => enabled ? `\x1b[2m\x1b[3m${x}\x1b[0m` : x;

export const white: Color = x => enabled ? `\x1b[37m${x}\x1b[0m` : x;
export const cyan: Color = x => enabled ? `\x1b[36m${x}\x1b[0m` : x;
