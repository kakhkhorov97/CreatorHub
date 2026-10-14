export enum Message {
	INVALID_IDENTIFIER = 'Invalid identifier',
	NO_DATA_FOUND = 'Record not found',
	NOT_OWNER = 'You do not own this record',
	ADMIN_ACCESS_REQUIRED = 'Administrator access required',
	ACCOUNT_UNAVAILABLE = 'Account unavailable',
	VERSION_CONFLICT = 'This record changed. Reload it before trying again.',
	ONLY_SPECIFIC_ROLES_ALLOWED = 'Only the specified roles are allowed',
	CREATOR_ACCESS_REQUIRED = 'Publish your creator profile before managing projects or services',
	VALUE_IN_USE = 'This unique value is already in use',
	VERIFICATION_EMAIL_NOT_SENT = 'Your account was created, but the verification email could not be sent. Request a new email.',
	INVALID_RECORD = 'Invalid record data',
	REQUEST_FAILED = 'The request could not be completed',
}
