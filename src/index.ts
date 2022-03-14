// import { gzipSync } from 'zlib';
import * as esbuild from 'esbuild';
import { builtinModules } from 'module';
import { dirname, resolve, join } from 'path';
// import { existsSync, readFileSync, writeFileSync } from 'fs';
// import { white, red, cyan, dim } from 'kleur';
import * as $ from './utils';

import type { Input } from './types';
import type { Options, Output } from '..';

export async function build(pkgdir: string, options?: Options) {
	options = options || {};
	pkgdir = resolve(pkgdir || '.');

	let rcfile = join(pkgdir, '.terserrc');
	let pkgfile = join(pkgdir, 'package.json');

	let pkg = $.exists(pkgfile) && await $.pkg(pkgfile);
	if (!pkg) return $.throws('Missing `package.json` file');

	let EXTN = /\.([mc]?[tj]sx?)$/;
	let i=0, key: string; // encoder = new TextEncoder;
	// let outputs = new Map<string, Input>();

	let inputs = await $.inputs(pkgdir, pkg);
	console.log(
		JSON.stringify({ inputs, pkgdir, pkg }, null, 2)
	);

	let config: esbuild.BuildOptions = {
		target: 'es2019', // TODO: --target=es2019
		treeShaking: true, // TODO: --minify || !condition.has(development)
		sourcemap: false, // TODO: --sourcemap
		logLevel: 'warning',
		minify: true, // TODO: --minify or !condition.has(production)
		charset: 'utf8',
		...options,
		external: options.external || [],
	};

	config.external = builtinModules.concat(
		pkg.external, config.external!
	);

	let outdirs = new Set<string>();
	let outfiles = new Set<string>();
	let outmap: {
		[input: string]: Set<string>; // output[]
	} = {};

	for (i=0; i < inputs.length; i++) {
		let uniq = new Set<string>();

		for (key in inputs[i].output) {
			let file = join(pkgdir, inputs[i].output[key]);
			outfiles.add(file);
			uniq.add(file);
		}

		outmap[ inputs[i].file ] = uniq;
	}

	for (key in outfiles) {
		outdirs.add(dirname(key));
		// TODO: verify file in "files" array
	}

	outdirs.delete(pkgdir);

	// purge -> recreate
	await Promise.all(
		[...outdirs].sort().map(dir => {
			// purge existing
			if ($.exists(dir)) {
				console.log(" REMOVING %s DIR", dir);
				// await $.rm(outdir, {
				// 	recursive: true,
				// 	force: true,
				// });
			}

			// safe writes
			return $.mkdir(dir);
		})
	);

	let results: Output = {};
	let isModule = pkg.module;
	// let isIMPORT = /(^|.)import(.|)/i;

	// TODO :: try/catch
	await Promise.all(
		inputs.map(async input => {
			let file = input.file;

			// TODO: respect "types" condition for output, else outdir
			// TODO: check `*.d.ts` existence; add to outmap
			// let dts: string|false = file.replace(EXTN, '.d.ts');
			// dts = $.exists(dts) && dts;

			// let outfile = join(pkgdir!, input.output);

			// build ts -> esm
			let esm = await esbuild.build({
				...config,
				// force these
				write: false,
				entryPoints: [file],
				format: 'esm',
				bundle: true,
			}).then(bundle => {
				return bundle.outputFiles[0];
			});

			// write file(s) if "import" found
			// look for sibling "require" for ESM~>CJS
			for (let c in input.output) {
				if ($.isModule(input.output[c], isModule)) {
					console.log('~> WRITE', input.output[c]);
				}
			}

			results[file] = Array.from(outmap[file]);
		})
	);

	console.log('~> done', [...inputs]);

	return results;
	// utils.table(pkg.name, pkgdir, outputs);
}
