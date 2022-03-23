#!/usr/bin/env node
const argv = process.argv.slice(2);

import type { Options } from '..';
type Argv = Record<string, string|true>;

(async function () {
	let i=0, j=0, key='';
	let input=[], flags: Argv = {};
	for (; i <= argv.length; i++) {
		if (i === argv.length) {
			if (key) flags[key] = true;
		} else if (argv[i].charCodeAt(0) === 45) {
			if (key) flags[key] = true;

			key = argv[i];
			if (key.charCodeAt(1) !== 45) {
				for (j=key.length-1; j-- > 1;) {
					flags['-'+key[j]] = true;
				}
				key = '-'+key[key.length-1];
			}
		} else {
			if (key) flags[key] = argv[i];
			else input.push(argv[i]);
			key = '';
		}
	}

	if (flags['--version'] || flags['-v']) {
		let { version } = require('./package.json');
		return console.log('bundt, v' + version);
	}

	if (flags['--help'] || flags['-h']) {
		let msg = '';
		msg += '\n  Usage';
		msg += '\n    $ bundt [directory] [options]\n';
		msg += '\n  Options';
		msg += '\n    -C, --cwd        The root working directory (default .)';
		msg += '\n    -c, --config     Path to configuration file (default: bundt.config.ts)';
		msg += '\n    -t, --target     The target environment (default: es2020)';
		msg += '\n    -x, --sourcemap  Generate inline sourcemaps';
		msg += '\n    -m, --minify     Minify output code';
		msg += '\n    -v, --version    Displays current version';
		msg += '\n    -h, --help       Displays this message\n';
		msg += '\n  Examples';
		msg += '\n    $ bundt --minify';
		msg += '\n    $ bundt -xm --target es2017';
		msg += '\n    $ bundt packages/utils -t=es2017';
		return console.log(msg + '\n');
	}

	// ensure boolean flags dont hoard value
	let minify = flags['--minify'] || flags['-m'];
	let sourcemap = flags['--sourcemap'] || flags['-x'];
	let nocolor = flags['--no-colors'] || flags['--no-color'];
	if (typeof sourcemap == 'string') input.unshift(sourcemap);
	if (typeof nocolor == 'string') input.unshift(nocolor);
	if (typeof minify == 'string') input.unshift(minify);

	const { resolve } = require('path');
	const bundt = await import('bundt');

	let options: Options = {};
	if (sourcemap) options.sourcemap = true;
	if (minify) options.minify = true;

	let tmp = flags['--target'] || flags['-t'];
	if (typeof tmp === 'string') options.target = tmp;

	let cwd = resolve(flags['--cwd'] || flags['-c'] || '.');
	let pkgdir = resolve(cwd, input[0] || '.');

	let start = process.hrtime();
	let output = await bundt.build(pkgdir, options);
	let delta = process.hrtime(start);

	console.log(
		await bundt.report(output, {
			cwd: pkgdir,
			delta: delta,
			colors: nocolor == null,
			gzip: true,
		})
	);
})().catch(err => {
	let msg = err && err.message || err;
	msg = msg ? msg.replace(/(\r?\n)/g, '$1      ') : 'Unknown error';
	console.error('\x1b[1m\x1b[31m[bundt]\x1b[0m', msg);
	process.exit(1);
});
