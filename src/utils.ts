import * as fs from 'fs';
import * as path from 'path';
import { gzipSync } from 'zlib';
import { createHash } from 'crypto';
import * as esbuild from 'esbuild';

import type { FileData, Input, Normal, Raw } from './types';

export const rm = fs.promises.rm;
export const mkdir = fs.promises.mkdir;
export const exists = fs.existsSync;

export const join = path.join;
export const resolve = path.resolve;
export const normalize = path.normalize;
export const relative = path.relative;
export const dirname = path.dirname;

export async function inspect(
	file: string,
	gzip: boolean
): Promise<FileData|void> {
	let buff = exists(file) && await fs.promises.readFile(file);

	if (buff) return {
		file: file,
		size: size(buff.byteLength),
		gzip: gzip && size(gzipSync(buff).byteLength),
	};
}

export function ls(dir: string) {
	return fs.promises.readdir(dir);
}

export function throws(msg: string): never {
	throw new Error(msg);
}

export function write(entry: string, files: esbuild.OutputFile[]) {
	let dir = dirname(entry);

	if (files.length > 0) {
		exists(dir) || fs.mkdirSync(dir, { recursive: true });
	}

	return Promise.all(
		files.map((o, i) => {
			return fs.promises.writeFile(
				i ? join(dir, o.path) : entry,
				o.contents
			);
		})
	);
}

const _ = ' ';
const UNITS = ['B ', 'kB', 'MB', 'GB'];

export function lpad(str: string, max: number): string {
	return _.repeat(max - str.length) + str;
}

export function rpad(str: string, max: number): string {
	return str + _.repeat(max - str.length);
}

export function size(val = 0): string {
	let x = Math.abs(val);
	if (x < 1e3) return `${val} ${UNITS[0]}`;
	let exp = Math.min(Math.floor(Math.log10(x) / 3), UNITS.length - 1) || 1;
	let num = (x / Math.pow(1e3, exp));
	let out = (val < 0 ? -num : num).toPrecision(3);
	let idx = out.indexOf('.');
	if (idx === -1) {
		out += '.00';
	} else if (out.length - idx - 1 !== 2) {
		out = (out + '00').substring(0, idx + 3); // 2 + 1 for 0-based
	}
	return out + ' ' + UNITS[exp];
}

export async function pkg(file: string): Promise<Normal.Package> {
	let x = JSON.parse(await fs.promises.readFile(file, 'utf8')) as Raw.Package;
	if (x.exports == null) return throws('Missing "exports" in `package.json` file');
	if (x.name == null) return throws('Missing "name" in `package.json` file');

	let key: string, arr = [x.name];
	for (key in x.peerDependencies) arr.push(key);
	for (key in x.devDependencies) arr.push(key);
	for (key in x.dependencies) arr.push(key);

	return {
		name: x.name,
		files: x.files || [],
		module: x.type === 'module',
		exports: entries(x),
		external: arr,
	};
}

export function isModule(file: string, isESM: boolean): boolean {
	let [, extn] = /\.([mc]?js)$/.exec(file) || [];
	return extn === 'mjs' || (isESM && extn === 'js');
}

const isJS = /\.[mc]?jsx?$/i;

export function flatten(
	output: Normal.Conditions,
	value: Raw.Conditions,
	cond?: string
): void {
	if (value == null) return;

	if (typeof value === 'string') {
		if (isJS.test(value) && !value.includes('*')) {
			output[cond || 'default'] = value;
		}
	} else {
		let prefix = cond ? (cond + '.') : '';

		for (let key in value) {
			if (key.includes('*')) continue;
			if (value[key]) flatten(output, value[key], prefix + key);
		}
	}
}

export function entries(pkg: Raw.Package): Normal.Exports {
	let output: Normal.Exports = {};

	// "exports": "./foobar.mjs"
	if (typeof pkg.exports === 'string') {
		if (isJS.test(pkg.exports)) output['.'] = {
			default: pkg.exports
		};
	} else {
		let isPath = false;
		let x: string, k: string;
		let tmp: Normal.Conditions;

		for (k in pkg.exports) {
			isPath = k.startsWith('.');
			break;
		}

		if (isPath) {
			for (k in pkg.exports) {
				// remove this? or expand it
				if (k.includes('*')) continue;
				flatten(tmp={}, pkg.exports![k], '');
				for (x in tmp) {
					output[k] = tmp;
					break;
				}
			}
		} else {
			flatten(tmp={}, pkg.exports!, '');
			for (k in tmp) {
				output['.'] = tmp;
				break;
			}
		}
	}

	return output;
}

export async function inputs(dir: string, pkg: Normal.Package): Promise<Input[]> {
	let inputs: Input[] = [];

	let paths = Object.keys(pkg.exports);
	if (paths.length < 1) return inputs;

	let src = join(dir, 'src');
	src = exists(src) ? src : dir;
	let files = await ls(src);

	let i=0, j=0, conds: Normal.Conditions, rgx: RegExp;
	let file: string, entry: string, types: string | null;

	for (paths.sort(); i < paths.length; i++) {
		entry = paths[i];
		conds = pkg.exports[entry];

		entry = entry.replace('./', '');
		if (entry === '.') entry = 'index';

		rgx = new RegExp('^' + entry + '(\\.[mc]?[tj]sx?)?$');

		for (j=0; j < files.length; j++) {
			if (rgx.test(files[j])) break;
		}

		file = files[j] && join(src, files[j]);
		if (file) {
			types = file.replace(/\.([mc]?[tj]sx?)$/, '.d.ts');
			types = exists(types) ? types : null;
			inputs.push({ file, types, output: conds });
		} else {
			throws(`Missing \`${entry}.([cm]?[tj]sx?)\` file for "${paths[i]}" entry`);
		}
	}

	return inputs;
}

/**
 * alphasort object/array recursively
 * fingerprint the object for bundle identity
 */
export function fingerprint<T extends object>(input: T): string {
	let i=0, tmp: unknown, sha=createHash('sha256');
	let keys = Object.keys(input) as Array<keyof T>;

	if (Array.isArray(input)) {
		for (; i < input.length; i++) {
			if ((tmp=input[i]) && typeof tmp === 'object') {
				input[i] = fingerprint(tmp);
			}
		}
		input.sort();
	} else {
		keys.sort();
	}

	for (i=0; i < keys.length; i++) {
		tmp = input[ keys[i] ];
		if (tmp && typeof tmp === 'object') {
			sha.update( fingerprint(tmp) );
		} else if (tmp != null) {
			sha.update(keys[i] + ':' + tmp);
		}
	}

	return sha.digest('hex');
}

export function bundle(options: esbuild.BuildOptions): Promise<esbuild.OutputFile[] | void> {
	options.write = false;
	return esbuild.build(options)
		.then(b => b.outputFiles)
		.catch(err => void 0);
}

export function time(sec: number, ns: number): string {
	let num = Math.round(ns / 1e6);

	if (sec < 1) return num + 'ms';
	return (sec + num / 1e3).toFixed(2) + 's';
}