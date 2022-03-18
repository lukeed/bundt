// import { gzipSync } from 'zlib';
import * as esbuild from 'esbuild';
import { builtinModules } from 'module';
import * as $ from './utils';

import type { FileData, Normal } from './types';
import type { Options, Output } from '..';

export async function build(pkgdir: string, options?: Options) {
	options = options || {};
	pkgdir = $.resolve(pkgdir || '.');

	let rcfile = $.join(pkgdir, '.terserrc');
	let pkgfile = $.join(pkgdir, 'package.json');

	let pkg = $.exists(pkgfile) && await $.pkg(pkgfile);
	if (!pkg) return $.throws('Missing `package.json` file');

	let i=0, key: string; // encoder = new TextEncoder;
	let tmp, conditions: Normal.Conditions;
	let inputs = await $.inputs(pkgdir, pkg);

	// TODO: find/load config file here

	let builds: Record<string, ReturnType<typeof $.bundle>> = {};
	let externals = builtinModules.concat(
		pkg.external, options.external || []
	);

	let outfiles = new Set<string>();
	let outdirs = new Set<string>();
	let mapping: {
		[input: string]: Set<string>; // output[]
	} = {};

	let isDEV = /(^|.)development(.|$)/;
	let isPROD = /(^|.)production(.|$)/;
	let isTYPES = /(^|.)types(.|$)/;

	let [isREQUIRE, isIMPORT] = pkg.module
		? [/(^|.)(require)(.|$)/, /(^|.)(import|default)(.|$)/]
		: [/(^|.)(require|default)(.|$)/, /(^|.)(import)(.|$)/];

	// let isBROWSER = /(^|.)browser(.|$)/;
	// let isNODE = /(^|.)node(.|$)/;

	for (i=0; i < inputs.length; i++) {
		conditions = inputs[i].output;
		for (key in conditions) {
			tmp = $.join(pkgdir, conditions[key]);
			outdirs.add($.dirname(tmp));
		}
	}

	outdirs.delete(pkgdir);

	await Promise.all(
		[...outdirs].map(d => {
			return $.rm(d, { recursive: true, force: true });
		})
	)

	for (i=0; i < inputs.length; i++) {
		let entry = inputs[i].file;
		let targets = new Set<string>();

		conditions = inputs[i].output;

		for (key in conditions) {
			let outfile = $.join(pkgdir, conditions[key]);
			let isRepeat = outfiles.has(outfile);

			if (isTYPES.test(key)) {
				// TODO, w/ isDONE marker
			} else {
				let config: esbuild.BuildOptions = {
					target: 'es2019',
					sourcemap: false,
					treeShaking: true,
					logLevel: 'warning',
					charset: 'utf8',
					minify: false,
					...options,
				};

				config.external = [...externals];
				config.sourcemap = config.sourcemap ?? isDEV.test(key);
				config.minify = config.minify || isPROD.test(key);

				// console.log('[TODO] user config', key, entry, config);
				console.log('[TODO] user config', entry, key);

				// force these
				config.write = false;
				config.entryPoints = [entry];
				config.format = 'esm';
				config.bundle = true;

				delete config.outfile;

				let hash = $.fingerprint(config);
				let bundle = builds[hash];

				if (bundle) {
					//
				} else if (isRepeat) {
					return $.throws(`Generating "${conditions[key]}" output using different configurations!`);
				} else {
					builds[hash] = bundle = $.bundle(config);
				}

				let outputs = await bundle;

				if (!outputs) {
					process.exitCode = 1;
					continue;
				}

				if (isIMPORT.test(key)) {
					await $.write(outfile, outputs);
				} else if (isREQUIRE.test(key)) {
					await $.write(outfile, outputs, true);
				}
			}

			// mark as seen
			outfiles.add(outfile);
			targets.add(outfile);
		}

		mapping[entry] = targets;
	}

	await Promise.all(
		Object.values(builds)
	);

	let results: Output = {};
	Object.keys(mapping).sort().forEach(key => {
		results[key] = [...mapping[key]];
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
