import * as esbuild from 'esbuild';
import { builtinModules } from 'module';
import * as $ from './utils';

import type { MinifyOptions } from 'terser';
import type { Chunk, FileData, Normal } from './types';
import type { Options, Output } from '..';

type BUILDHASH = string;

export async function build(pkgdir: string, options?: Options) {
	options = options || {};
	pkgdir = $.resolve(pkgdir || '.');

	let rcfile = $.join(pkgdir, '.terserrc');
	let pkgfile = $.join(pkgdir, 'package.json');

	let pkg = $.exists(pkgfile) && await $.pkg(pkgfile);
	if (!pkg) return $.throws('Missing `package.json` file');

	let conditions: Normal.Conditions;
	let i=0, j=0, key: string, outfile: string, tmp;
	let inputs = await $.inputs(pkgdir, pkg);

	let terser = $.exists(rcfile) && await $.toJSON<MinifyOptions>(rcfile) || {};

	// TODO: find/load config file here

	let outfiles = new Set<string>();
	let builds: Record<string, ReturnType<typeof $.bundle>> = {};
	let externals = builtinModules.concat(
		pkg.external, options.external || []
	);

	let graph: {
		[input: string]: Set<string>; // output[]
	} = {};

	let CHUNKS: Record<BUILDHASH, Chunk[]> = {};
	let HASHES: { [entry_key: string]: BUILDHASH } = {};

	let isDEV = /(^|.)development(.|$)/;
	let isPROD = /(^|.)production(.|$)/;
	let isTYPES = /(^|.)types(.|$)/;

	let [isREQUIRE, isIMPORT] = pkg.module
		? [/(^|.)(require)(.|$)/, /(^|.)(import|default)(.|$)/]
		: [/(^|.)(require|default)(.|$)/, /(^|.)(import)(.|$)/];

	// let isBROWSER = /(^|.)browser(.|$)/;
	// let isNODE = /(^|.)node(.|$)/;

	for (i=0; i < inputs.length; i++) {
		let entry = inputs[i].file;
		let targets = new Set<string>();

		conditions = inputs[i].output;

		for (key in conditions) {
			outfile = $.join(pkgdir, conditions[key]);
			let isRepeat = outfiles.has(outfile);

			if (isTYPES.test(key)) {
				// TODO, w/ isDONE marker
			} else {
				let config: esbuild.BuildOptions = {
					target: 'es2019',
					treeShaking: true,
					logLevel: 'warning',
					charset: 'utf8',
					...options,
				};

				config.external = [...externals];
				config.minify ??= isPROD.test(key);
				config.sourcemap ??= isDEV.test(key);

				// console.log('[TODO] user config', key, entry, config);
				console.log('[TODO] user config', entry, key);

				// force these
				config.write = false;
				config.entryPoints = [entry];
				config.format = 'esm';
				config.bundle = true;

				delete config.outfile;

				let hash: BUILDHASH = $.fingerprint(config);
				let bundle = builds[hash];

				if (bundle) {
					//
				} else if (isRepeat) {
					return $.throws(`Generating "${conditions[key]}" output using different configurations!`);
				} else {
					builds[hash] = bundle = $.bundle(config, terser);
				}

				let chunks = await bundle;

				if (!chunks) {
					process.exitCode = 1;
					continue;
				}

				if (isIMPORT.test(key)) {
					hash += '|import';
				} else if (isREQUIRE.test(key)) {
					hash += '|require';
					if (CHUNKS[hash] == null) {
						for (j=0; j < chunks.length; j++) {
							chunks[j].text = $.convert(chunks[j].text);
						}
					}
				}

				CHUNKS[hash] ||= chunks;
				HASHES[`${inputs[i].entry}>${key}`] = hash;
			}

			// mark as seen
			outfiles.add(outfile);
			targets.add(outfile);
		} // end per-condition

		graph[entry] = targets;
	}

	await Promise.all(
		Object.values(builds)
	);

	let OUTDIRS = new Set<string>();
	let WRITES: Array<[string, string]> = [];

	for (i=0; i < inputs.length; i++) {
		conditions = inputs[i].output;

		for (key in conditions) {
			outfile = $.join(pkgdir, conditions[key]);
			OUTDIRS.add( $.dirname(outfile) );

			let hash = HASHES[`${inputs[i].entry}>${key}`];
			if (!hash) $.throws(`Missing output files for "${inputs[i].entry}">"${key}" build`);

			if (CHUNKS[hash]) WRITES.push([outfile, hash]);
			else $.throws(`Invalid "${hash}" identifier`);
		}
	}

	OUTDIRS.delete(pkgdir);
	await $.reset([...OUTDIRS]);

	await Promise.all(
		WRITES.map(args => {
			return $.write(args[0], CHUNKS[args[1]]!);
		})
	);

	let results: Output = {};
	Object.keys(graph).sort().forEach(key => {
		results[key] = [...graph[key]];
	});

	return results;
}

export async function report(results: Output, options: {
	cwd?: string;
	gzip?: boolean;
	delta?: [number, number];
} = {}): Promise<string> {
	let gzip = !!options.gzip;
	let cwd = $.resolve(options.cwd || '.');

	let max=0, f=4, s=8, g=6;
	let i=0, input: string, output='', tmp;
	let record: Record<string, FileData[]> = {};

	for (input in results) {
		let files: FileData[] = [];

		await Promise.all(
			results[input].map(async file => {
				let stats = await $.inspect(file, gzip);

				if (stats) {
					stats.file = $.normalize(
						$.relative(cwd, stats.file)
					);

					f = Math.max(f, stats.file.length);
					s = Math.max(s, stats.size.length);
					if (stats.gzip) {
						g = Math.max(g, stats.gzip.length);
					}

					files.push(stats);
				}
			})
		);

		input = $.normalize(
			$.relative(cwd, input)
		);

		f = Math.max(f, input.length);

		i = 4 + 2 + f + s;
		if (gzip) i += 2 + g;
		max = Math.max(max, i);

		record[input] = files.sort((a, b) => {
			return a.file.localeCompare(b.file);
		});
	}

	for (input in record) {
		output += '\n  ' + $.rpad(input, f) + '    ' + $.lpad('Filesize', s);
		if (gzip) output += '  ' + $.lpad('(gzip)', g);

		for (i=0; i < record[input].length; i++) {
			tmp = record[input][i];
			output += '\n    ' + $.rpad(tmp.file, f);
			output += '  ' + $.lpad(tmp.size, s);
			if (gzip) output += '  ' + $.lpad(tmp.gzip as string, g);
		}

		output += '\n';
	}

	if (options.delta) {
		output += '\n' + $.lpad('Done in ' + $.time(...options.delta), max) + '\n';
	}

	return '\n' + output + '\n';
}
