import type { BuildOptions } from 'esbuild';

export type Options = Omit<BuildOptions,
	| 'write' | 'allowOverwrite' | 'stdin'
	| 'outfile' | 'entryPoints'
>;

export type Output = {
	[input: string]: string[];
}

export function build(pkgdir: string, options?: Options): Promise<Output>;

export function report(results: Output, options?: {
	cwd?: string;
	gzip?: boolean;
	delta?: [number, number];
	colors?: boolean;
}): Promise<string>;
