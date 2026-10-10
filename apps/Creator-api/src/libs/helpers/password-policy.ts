export const NEW_PASSWORD_PATTERN = /^(?=[\s\S]*\p{L})(?=[\s\S]*[0-9])(?=[\s\S]*[^\p{L}\p{N}\s])[\s\S]+$/u;

export const NEW_PASSWORD_MESSAGE = 'Password must contain a letter, a number, and a symbol.';
