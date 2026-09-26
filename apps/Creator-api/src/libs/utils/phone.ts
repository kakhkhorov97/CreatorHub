import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

// Require an international prefix rather than guessing the user's country.
export function normalizePhone(value: string): string {
	if (!value.trim().startsWith('+')) return value;
	const phone = parsePhoneNumberFromString(value.trim());
	return phone?.isValid() && !phone.ext ? phone.number : value;
}
