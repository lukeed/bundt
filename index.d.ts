import type { BuildOptions } from 'esbuild';

export type Options = Omit<BuildOptions,
	| 'write' | 'allowOverwrite' | 'stdin'
	| 'outfile' | 'entryPoints'
	| 'bundle' | 'format'
>;
