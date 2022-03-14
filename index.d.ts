import type { BuildOptions } from 'esbuild';

export type Options = Omit<BuildOptions,
	| 'write' | 'allowOverwrite' | 'stdin'
	| 'outfile' | 'entryPoints'
	| 'bundle' | 'format'
>;

export type Output = {
	[input: string]: string[];
}

export function build(pkgdir: string, options?: Options): Promise<Output>;
