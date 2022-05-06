export namespace Raw {
	export type Exports = Conditions | {
		[path: string]: Conditions;
	}

	export type Conditions = string | {
		[cond: string]: string | Conditions;
	};

	// original package.json
	export interface Package {
		name?: string;
		bin?: string | Record<string, string>;
		exports?: Exports;
		files?: string[];
		type?: 'module' | 'commonjs';
		dependencies?: Record<string, string>;
		peerDependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
	}
}

export namespace Normal {
	export type Conditions = {
		[cond: string]: string;
	}

	export type Exports = {
		[path: string]: Conditions;
	}

	// formatted package.json
	export interface Package {
		name: string;
		module: boolean;
		external: string[];
		exports: Exports;
		files?: string[];
		bin?: Map<string, string>;
	}
}

export interface Chunk {
	name: string;
	text: string;
}

export interface Input {
	file: string | null;
	types: string | null;
	output: Normal.Conditions;
	entry: string;
	outdirs?: Set<string>;
	typeout?: Set<string>;
}

export interface FileData {
	file: string;
	size: string;
	gzip: string | false;
}
