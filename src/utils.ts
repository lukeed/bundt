import * as fs from 'fs';
import * as path from 'path';
import { gzipSync } from 'zlib';
import { createHash } from 'crypto';
import rimports from 'rewrite-imports';

let terser: typeof import('terser');
let esbuild: typeof import('esbuild');

import type { FileData, Input, Normal, Raw } from './types';
import type { MinifyOptions, MinifyOutput } from 'terser';
import type { BuildOptions } from 'esbuild';

interface Chunk {
	name: string;
	text: string;
}

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

export async function minify(content: string, options?: MinifyOptions): Promise<MinifyOutput> {
		terser ||= await import('terser');

	return terser.minify(content, {
		module: true,
		compress: true,
		mangle: true,
		...options,
	});
}

export function write(entry: string, files: Chunk[], isCJS?: boolean) {
	let dir = dirname(entry);

	if (files.length > 0) {
		exists(dir) || fs.mkdirSync(dir, { recursive: true });
	}

	return Promise.all(
		files.map(async (o, i) => {
			let file = i ? join(dir, o.name) : entry;
			let data = isCJS ? convert(o.text) : o.text;
			return fs.promises.writeFile(file, data);
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

export async function toJSON<T>(file: string): Promise<T> {
	return JSON.parse(await fs.promises.readFile(file, 'utf8'));
}

export async function pkg(file: string): Promise<Normal.Package> {
	let x = await toJSON<Raw.Package>(file);
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

export async function bundle(config: BuildOptions, options?: MinifyOptions): Promise<Chunk[] | void> {
	config.write = false;
	esbuild ||= await import('esbuild');

	let b = await esbuild.build(config).catch(err => void 0);
	let files = b && b.outputFiles || [];
	if (!files.length) return;

	let i=0, chunks: Chunk[] = [];

	if (config.minify) {
		terser ||= await import('terser');

		await Promise.all(
			files.map(async o => {
				// TODO: inline|external sourcemap
				let out = await minify(o.text, options);
				if (!out.code) throws('Invalid terser output');
				chunks.push({ name: o.path, text: out.code });
			})
		);
	} else {
		for (; i < files.length; i++) {
			chunks.push({
				name: files[i].path,
				text: files[i].text,
			});
		}
	}

	return chunks;
}

export function time(sec: number, ns: number): string {
	let num = Math.round(ns / 1e6);

	if (sec < 1) return num + 'ms';
	return (sec + num / 1e3).toFixed(2) + 's';
}

/**
 * @TODO wait for https://github.com/evanw/esbuild/issues/1079
 */
export function convert(content: string) {
	let footer = '';
	return rimports(content)
		.replace(/(^|\s|;)export default/, '$1module.exports =')
		.replace(/(^|\s|;)export (const|(?:async )?function|class|let|var) (.+?)(?=(\(|\s|\=))/gi, (_, x, type, name) => {
			footer += `\nexports.${name} = ${name};`;
			return `${x}${type} ${name}`;
		})
		.replace(/(^|\s|\n|;?)export[ ]*?\{([\s\S]*?)\};?([\n\s]*?|$)/g, (_, x, names: string) => {
			names.split(',').forEach(name => {
				let [src, dest] = name.trim().split(/\s+as\s+/);
				footer += `\nexports.${dest || src} = ${src};`;
			});
			return x;
		})
		.concat(
			footer
		);
}
