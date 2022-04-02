import type { Options } from 'bundt';

export interface Input {
	file: string | null;
	export: string;
	condition: string;
}

export type Customize = (
	input: Input,
	options: Options,
) => Promise<Options | false | void> | Options | false | void;

export function define(fn: Customize): Customize;
