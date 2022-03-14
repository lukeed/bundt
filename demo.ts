import { join, resolve } from 'path';
import { build } from './src/index';

const fixtures = resolve('./test/fixtures');

await build(
	join(fixtures, 'exports')
).then(console.log);
