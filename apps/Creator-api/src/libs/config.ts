export function validateEnvironment(input: Record<string, unknown>) {
	const env = { ...input };
	const production = env.NODE_ENV === 'production';
	const secret = env.JWT_SECRET ?? env.SECRET_TOKEN;
	if (typeof secret !== 'string' || secret.length < 32)
		throw new Error('Set SECRET_TOKEN or JWT_SECRET to at least 32 random characters');
	env.JWT_SECRET = secret;
	const uri = production ? env.MONGO_PROD : env.MONGO_DEV;
	if (typeof uri !== 'string' || !/^mongodb(?:\+srv)?:\/\//.test(uri))
		throw new Error(`Set ${production ? 'MONGO_PROD' : 'MONGO_DEV'} to a MongoDB replica-set URI`);
	env.FRONTEND_URL ??= 'http://localhost:3000';
	env.MEDIA_BASE_URL ??= 'https://media.example.com/creatorhub';
	for (const name of ['FRONTEND_URL', 'MEDIA_BASE_URL', 'MAIL_WEBHOOK_URL', 'DISCOVERY_PARSER_URL']) {
		if (!env[name]) continue;
		const url = new URL(String(env[name]));
		if (
			url.username ||
			url.password ||
			(url.protocol !== 'https:' && !(name === 'FRONTEND_URL' && !production && url.protocol === 'http:'))
		)
			throw new Error(`${name} must be a valid HTTPS URL`);
	}
	if (production && (!env.MAIL_WEBHOOK_URL || !env.MAIL_WEBHOOK_TOKEN || !input.MEDIA_BASE_URL))
		throw new Error('Production requires email delivery and media storage configuration');
	if (env.MAIL_WEBHOOK_URL && !env.MAIL_WEBHOOK_TOKEN) throw new Error('Set MAIL_WEBHOOK_TOKEN for email delivery');
	if (env.DISCOVERY_PARSER_URL && !env.DISCOVERY_PARSER_TOKEN)
		throw new Error('Set DISCOVERY_PARSER_TOKEN for the discovery provider');
	return env;
}
