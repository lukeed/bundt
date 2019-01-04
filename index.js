const { gzipSync } = require('zlib');
const { existsSync, readFileSync, writeFileSync } = require('fs');
const { dirname, normalize, resolve } = require('path');
const imports = require('rewrite-imports');
const { minify } = require('terser');
const mkdir = require('mk-dirs');

function write(file, data) {
	file = normalize(file);
	return mkdir(dirname(file)).then(() => {
		writeFileSync(file, data);
	});
}

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

const { code, error } = minify(CJS, { toplevel:true });
const mount = /[.-]/.test(name) ? `['${name}']` : `.${name}`;
console.log(code, error);

const UMD = isDefault
	? `!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define(t):e${mount}=t()}(this,function(){${code.replace(/module.exports=/, 'return ')}});`
	: `!function(e,n){"object"==typeof exports&&"undefined"!=typeof module?n(exports):"function"==typeof define&&define.amd?define(["exports"],n):n(e${mount}={})}(this,function(e){${code}})));`

// Writes
if (output.esm) write(output.esm, ESM);
if (output.cjs) write(output.cjs, CJS);
if (output.umd) write(output.umd, UMD);

console.log('TODO size(s?)', size(gzipSync(code).length));
