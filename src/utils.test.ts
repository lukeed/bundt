import { suite } from 'uvu';
import * as assert from 'uvu/assert';
import * as utils from './utils';

// ---

const throws =  suite('throws');

throws('should be a function', () => {
	assert.type(utils.throws, 'function');
});

throws('should throw Error w/ message', () => {
	try {
		utils.throws('hello');
		assert.unreachable();
	} catch (err) {
		assert.instance(err, Error);
		assert.is((err as Error).message, 'hello');
	}
});

throws.run();

// ---

const lpad =  suite('lpad');

lpad('should be a function', () => {
	assert.type(utils.lpad, 'function');
});

lpad('should add left padding to string', () => {
	let output = utils.lpad('howdy', 7);
	assert.is(output, '  howdy');
});

lpad('should do nothing if maxlen is string length', () => {
	let output = utils.lpad('howdy', 5);
	assert.is(output, 'howdy');
});

lpad.run();

// ---

const rpad =  suite('rpad');

rpad('should be a function', () => {
	assert.type(utils.rpad, 'function');
});

rpad('should add right padding to string', () => {
	let output = utils.rpad('howdy', 7);
	assert.is(output, 'howdy  ');
});

rpad('should do nothing if maxlen is string length', () => {
	let output = utils.rpad('howdy', 5);
	assert.is(output, 'howdy');
});

rpad.run();

// ---

const size =  suite('size');

size('should be a function', () => {
	assert.type(utils.size, 'function');
});

size('should handle zero', () => {
	assert.is(utils.size(), '0 B ');
	assert.is(utils.size(0), '0 B ');
});

size('should handle positives', () => {
	assert.is(utils.size(1), '1 B ');
	assert.is(utils.size(123), '123 B ');

	assert.is(utils.size(1e3), '1.00 kB');
	assert.is(utils.size(1024), '1.02 kB');
	assert.is(utils.size(1.23e3), '1.23 kB');
	assert.is(utils.size(100e3), '100.00 kB');

	assert.is(utils.size(1e6), '1.00 MB');
	assert.is(utils.size(1.23e6), '1.23 MB');
	assert.is(utils.size(11.29e6), '11.30 MB');

	assert.is(utils.size(1e9), '1.00 GB');
	assert.is(utils.size(1.23e9), '1.23 GB');
	assert.is(utils.size(11.29e9), '11.30 GB');

	assert.is(utils.size(10e3), '10.00 kB');
	assert.is(utils.size(100e3), '100.00 kB');
});

size('should handle negatives', () => {
	assert.is(utils.size(-1), '-1 B ');
	assert.is(utils.size(-123), '-123 B ');

	assert.is(utils.size(-1e3), '-1.00 kB');
	assert.is(utils.size(-1024), '-1.02 kB');
	assert.is(utils.size(-1.23e3), '-1.23 kB');
	assert.is(utils.size(-100e3), '-100.00 kB');

	assert.is(utils.size(-1e6), '-1.00 MB');
	assert.is(utils.size(-1.23e6), '-1.23 MB');
	assert.is(utils.size(-11.29e6), '-11.30 MB');

	assert.is(utils.size(-1e9), '-1.00 GB');
	assert.is(utils.size(-1.23e9), '-1.23 GB');
	assert.is(utils.size(-11.29e9), '-11.30 GB');

	assert.is(utils.size(-10e3), '-10.00 kB');
	assert.is(utils.size(-100e3), '-100.00 kB');
});

size.run();

// ---

const pkg =  suite('pkg');

pkg('should be a function', () => {
	assert.type(utils.pkg, 'function');
});

pkg.run();

// ---

const flatten =  suite('flatten');

flatten('should be a function', () => {
	assert.type(utils.flatten, 'function');
});

flatten('should handle shallow conditions', () => {
	let output = {};
	let foo = utils.flatten(output, './x.js', '');
	assert.is(foo, undefined);

	assert.equal(output, {
		default: './x.js'
	});

	let input: any = {
		default: './foo.js'
	};

	utils.flatten(output={}, input, '');
	assert.equal(output, {
		default: './foo.js'
	});

	input = {
		default: './foo.js',
		require: './r.cjs',
		import: './i.mjs',
	};

	utils.flatten(output={}, input, '');
	assert.equal(output, {
		default: './foo.js',
		require: './r.cjs',
		import: './i.mjs',
	});
});

flatten('should flatten nested conditions', () => {
	let $exports = {
		browser: {
			production: {
				import: './b.min.mjs',
				require: './b.min.cjs',
			},
			development: {
				import: './b.dev.mjs',
				require: './b.dev.cjs',
			},
			import: './b.mjs',
			require: './b.cjs'
		},
		node: {
			import: './n.mjs',
			require: './n.cjs',
		},
		import: './i.mjs',
		require: './r.cjs'
	};

	let output = {};
	utils.flatten(output, $exports, '');

	assert.equal(output, {
		'browser.production.import': './b.min.mjs',
		'browser.production.require': './b.min.cjs',
		'browser.development.import': './b.dev.mjs',
		'browser.development.require': './b.dev.cjs',
		'browser.import': './b.mjs',
		'browser.require': './b.cjs',
		'node.import': './n.mjs',
		'node.require': './n.cjs',
		'import': './i.mjs',
		'require': './r.cjs',
	});
});

flatten('should ignore non-JS extensions', () => {
	let input = {
		browser: {
			json: './b.json',
			types: './b.d.ts',
			import: './b.json',
			default: './b.json',
			require: './b.js',
		},
		require: './r.cjs',
		default: './d.css',
	};

	let output = {};
	utils.flatten(output, input, '');

	assert.equal(output, {
		'browser.require': './b.js',
		'browser.types': './b.d.ts',
		'require': './r.cjs',
	});
});

flatten.run();

// ---

const entries =  suite('entries');

entries('should be a function', () => {
	assert.type(utils.entries, 'function');
});

entries('should convert "string" exports into "default" condition', () => {
	let output = utils.entries({
		exports: './foobar.js'
	});

	assert.equal(output, {
		'.': {
			default: './foobar.js'
		}
	});
});

entries('should handle root export conditions', () => {
	let output = utils.entries({
		exports: {
			production: {
				import: './i.min.mjs',
				require: './r.min.cjs',
			},
			import: './i.mjs',
			require: './r.cjs',
		}
	});

	assert.equal(output, {
		'.': {
			'production.import': './i.min.mjs',
			'production.require': './r.min.cjs',
			'import': './i.mjs',
			'require': './r.cjs',
		}
	});
});

entries('should ignore non-JS extensions', () => {
	let output = utils.entries({
		exports: './foobar.json'
	});

	assert.equal(output, {
		//
	});
});

entries('should handle complex "exports" mapping', () => {
	let output = utils.entries({
		exports: {
			'.': {
				import: './i.mjs',
				require: './r.cjs',
			},
			'./foo': {
				browser: {
					import: './foo/b.mjs',
					require: './foo/b.cjs',
				},
				node: {
					import: './foo/n.mjs',
					require: './foo/n.cjs',
				},
			},
			'./package.json': './package.json'
		}
	});

	assert.equal(output, {
		'.': {
			'import': './i.mjs',
			'require': './r.cjs',
		},
		'./foo': {
			'browser.import': './foo/b.mjs',
			'browser.require': './foo/b.cjs',
			'node.import': './foo/n.mjs',
			'node.require': './foo/n.cjs',
		}
	});
});

entries.run();

// ---

const inputs =  suite('inputs');

inputs('should be a function', () => {
	assert.type(utils.inputs, 'function');
});

inputs.run();

// ---

const fingerprint = suite('fingerprint');

fingerprint('should be a function', () => {
	assert.type(utils.fingerprint, 'function');
});

fingerprint('should identify an object', () => {
	let output = utils.fingerprint({ foo: 123 });
	assert.type(output, 'string');
	assert.is(output, '9e34594d7c06c98a3a611410d2808b0e915982b46ef41106cb7edabd3f0d6510');
});

fingerprint('should sort object keys :: shallow', () => {
	let foo = utils.fingerprint({ a: 1, b: 2 });
	let bar = utils.fingerprint({ b: 2, a: 1 });
	assert.is(foo, '81eb42d9b7f448d9d35d384a3d4e57cbf9566765fff5744a9635609ce64d72e6');
	assert.is(foo, bar);
});

fingerprint('should sort object keys :: nested', () => {
	let foo = utils.fingerprint({
		a: 1,
		b: 2,
		c: {
			a: 1,
			b: 2,
			c: {
				a: 1,
				b: 2,
				c: 3,
			},
		}
	});

	let bar = utils.fingerprint({
		b: 2,
		c: {
			b: 2,
			a: 1,
			c: {
				c: 3,
				b: 2,
				a: 1,
			},
		},
		a: 1,
	});

	assert.is(foo, 'f217b48d47d752b593b834660456dc465771e272378cc5e30869a9e33188890a');
	assert.is(foo, bar);
});

fingerprint('should sort array contents :: shallow', () => {
	let foo = utils.fingerprint([1, 2, 3]);
	let bar = utils.fingerprint([3, 2, 1]);

	assert.is(foo, '492f06976c8bc705819f5d33d71be6a80a547b03f87c377e3543605d8260159c');
	assert.is(foo, bar);
});

fingerprint('should sort array contents :: nested', () => {
	let foo = utils.fingerprint(
		[1, [1, 2, [1,2,[1,2,[1,2,3]]]], 3]
	);

	let bar = utils.fingerprint(
		[3, 1, [2, 1, [2,1,[1,[3,1,2],2]]]]
	);

	assert.is(foo, '2ebf459d47e29b8413971ac56a6e60da98ce3d6e99d25ee65e0a7a5f0b7f039a');
	assert.is(foo, bar);
});

fingerprint.run();
