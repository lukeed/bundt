export namespace Raw {
	export type Exports = Conditions | {
		[path: string]: Conditions;
	}

	export type Conditions = string | {
		[cond: string]: string | Conditions;
	};

	// original package.json
	export type Package = {
		name?: string;
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
	export type Package = {
		name: string;
		files: string[];
		module: boolean;
		external: string[];
		exports: Exports;
	}
}

export type Input = {
	file: string;
	types: string | null;
	output: Normal.Conditions;
}

export type FileData = {
	file: string;
	size: string;
	gzip: string | false;
}
