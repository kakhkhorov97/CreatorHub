import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { DraftFieldsInput } from '../src/libs/dto/inquiry/inquiry.input';
describe('Inquiry budget validation', () => {
	it.each([-1, '100', 'text', 1.2, 1000000001, null])(
		'rejects invalid budget value %p at the API boundary',
		async (value) => {
			const errors = await validate(plainToInstance(DraftFieldsInput, { budgetMin: value, budgetMax: value }));
			expect(errors.some((error) => error.property === 'budgetMin')).toBe(true);
			expect(errors.some((error) => error.property === 'budgetMax')).toBe(true);
		},
	);
	it.each([0, 100, 1000000000])('accepts an integer budget %p', async (value) => {
		expect(await validate(plainToInstance(DraftFieldsInput, { budgetMin: value, budgetMax: value }))).toEqual([]);
	});
});
