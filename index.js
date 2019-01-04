const { gzipSync } = require('zlib');
const { existsSync, readFileSync, writeFileSync } = require('fs');
const { dirname, normalize, resolve } = require('path');
const imports = require('rewrite-imports');
const { minify } = require('terser');
const mkdir = require('mk-dirs');

const UNITS = ['B ', 'kB', 'MB', 'GB'];

function size(val=0) {
	if (val < 1e3) return `${val} ${UNITS[0]}`;
	let exp = Math.min(Math.floor(Math.log10(val) / 3), UNITS.length - 1) || 1;
	let out = (val / Math.pow(1e3, exp)).toPrecision(3);
	let idx = out.indexOf('.');
	if (idx === -1) {
		out += '.00';
	} else if (out.length - idx - 1 !== 2) {
		out = (out + '00').substring(0, idx + 3); // 2 + 1 for 0-based
	}
	return out + ' ' + UNITS[exp];
}

function write(file, data, isUMD) {
	file = normalize(file);
	return mkdir(dirname(file)).then(() => {
		let { code } = minify(data, { toplevel:!isUMD }); // TODO
		writeFileSync(file, isUMD ? code : data);
	});
}

const argv = process.argv.slice(2);
const entry = resolve(argv[0] || 'src/index.js');

const pkgfile = resolve('package.json');
const pkg = existsSync(pkgfile) && require(pkgfile);
const name = pkg['umd:name'] || pkg.name;

if (!pkg) {
	return console.log('Does not exist: %s', pkg);
}

if (!existsSync(entry)) {
	return console.log('Does not exist: %s', entry);
}

// Parsed config
const output = {
	cjs: pkg.main || `dist/${pkg.name}.js`,
	umd: pkg.unpkg || pkg['umd:main'],
	esm: pkg.module,
};

const ESM = readFileSync(entry, 'utf8');
const mount = /[.-]/.test(name) ? `['${name}']` : `.${name}`;
const isDefault = /export default/.test(ESM);

let keys = [];
let CJS = imports(ESM)
	.replace(/export default/, 'module.exports =')
	.replace(/export (const|function) (.+?)(?=(\(|\s|\=))/gi, (_, type, name) => {
		return keys.push(name) && `${type} ${name}`;
	});

if (keys.length > 0) {
	keys.sort().forEach(key => {
		CJS += `\nexports.${key} = ${key};`;
	});
}

const UMD = isDefault
	? `!function(global,factory){"object"==typeof exports&&"undefined"!=typeof module?module.exports=factory():"function"==typeof define&&define.amd?define(factory):global${mount}=factory()}(this,function(){${CJS.replace(/module.exports=/, 'return ')}});`
	: `!function(global,factory){"object"==typeof exports&&"undefined"!=typeof module?factory(exports):"function"==typeof define&&define.amd?define(["exports"],factory):factory(global${mount}={})}(this,function(global){${CJS}});`

// Writes
if (output.cjs) write(output.cjs, CJS),
if (output.esm) write(output.esm, ESM),
if (output.umd) write(output.umd, UMD, 1),

console.log('TODO size(s?)', size(gzipSync(code).length));
