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
	env.FRONTEND_URL ??= 'http://localhost:7007';
	env.UPLOAD_BASE_URL ??= `http://localhost:${env.PORT_API ?? 7001}/uploads`;
	env.MEDIA_BASE_URL ??= env.UPLOAD_BASE_URL;
	for (const name of [
		'FRONTEND_URL',
		'MEDIA_BASE_URL',
		'UPLOAD_BASE_URL',
		'MAIL_WEBHOOK_URL',
		'DISCOVERY_PARSER_URL',
	]) {
		if (!env[name]) continue;
		const url = new URL(String(env[name]));
		if (
			url.username ||
			url.password ||
			(url.protocol !== 'https:' &&
				!(
					['FRONTEND_URL', 'MEDIA_BASE_URL', 'UPLOAD_BASE_URL'].includes(name) &&
					!production &&
					url.protocol === 'http:'
				))
		)
			throw new Error(`${name} must be a valid HTTPS URL`);
	}
	if (Boolean(env.RESEND_API_KEY) !== Boolean(env.RESEND_FROM_EMAIL))
		throw new Error('Set both RESEND_API_KEY and RESEND_FROM_EMAIL for Resend delivery');
	if (env.RESEND_API_KEY && (typeof env.RESEND_API_KEY !== 'string' || !/^re_\S+$/.test(env.RESEND_API_KEY)))
		throw new Error('Set a valid RESEND_API_KEY');
	if (
		env.RESEND_FROM_EMAIL &&
		(typeof env.RESEND_FROM_EMAIL !== 'string' ||
			/[\r\n]/.test(env.RESEND_FROM_EMAIL) ||
			!/^(?:[^<>]+<)?[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/.test(env.RESEND_FROM_EMAIL))
	)
		throw new Error('Set a valid RESEND_FROM_EMAIL sender');
	const emailConfigured =
		(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL) || (env.MAIL_WEBHOOK_URL && env.MAIL_WEBHOOK_TOKEN);
	if (production && (!emailConfigured || !input.UPLOAD_BASE_URL))
		throw new Error('Production requires email delivery and an HTTPS UPLOAD_BASE_URL');
	if (env.MAIL_WEBHOOK_URL && !env.MAIL_WEBHOOK_TOKEN) throw new Error('Set MAIL_WEBHOOK_TOKEN for email delivery');
	if (env.DISCOVERY_PARSER_URL && !env.DISCOVERY_PARSER_TOKEN)
		throw new Error('Set DISCOVERY_PARSER_TOKEN for the discovery provider');
	return env;
}
