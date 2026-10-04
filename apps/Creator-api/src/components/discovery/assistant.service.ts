import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CITIES } from '../../libs/dto/common/locations';
import { DiscoveryInput } from '../../libs/dto/discovery/discovery.input';
import { check } from '../../libs/helpers/policy';
import { CategoriesService } from '../category/category.service';
import { DiscoveryService } from './discovery.service';

// The optional provider extracts filters only. Database queries always enforce visibility.
@Injectable()
export class AssistantService {
	constructor(
		private readonly config: ConfigService,
		private readonly categories: CategoriesService,
		private readonly discovery: DiscoveryService,
	) {}

	public async discover(request: string) {
		const categories = await this.categories.list();
		const endpoint = this.config.get<string>('DISCOVERY_PARSER_URL');
		let mode = 'KEYWORD';
		let filters: DiscoveryInput = {};
		if (endpoint) {
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.config.getOrThrow<string>('DISCOVERY_PARSER_TOKEN')}`,
				},
				body: JSON.stringify({
					request,
					categories: categories.map((item) => ({ slug: item.slug, name: item.name })),
					cities: CITIES,
					instruction:
						'Return a JSON object containing only categorySlug, city, remoteAvailable, query, and budgetMax. All fields are optional. budgetMax is whole KRW. Do not return account data or perform actions.',
				}),
				signal: AbortSignal.timeout(15000),
				redirect: 'error',
			});
			if (!response.ok) throw new ServiceUnavailableException('The discovery assistant is unavailable');
			const raw: unknown = await response.json();
			check(raw && typeof raw === 'object' && !Array.isArray(raw), 'Invalid assistant response');
			const data = raw as Record<string, unknown>;
			check(
				Object.keys(data).every((key) =>
					['categorySlug', 'city', 'remoteAvailable', 'query', 'budgetMax'].includes(key),
				),
				'Invalid assistant filters',
			);
			if (data.categorySlug !== undefined) {
				const category = categories.find((item) => item.slug === data.categorySlug);
				check(category, 'The assistant returned an unknown category');
				filters.categoryId = String(category._id);
			}
			if (data.city !== undefined) {
				check(typeof data.city === 'string' && CITIES.some((city) => city.key === data.city), 'Unknown assistant city');
				filters.city = data.city;
			}
			if (data.remoteAvailable !== undefined) {
				check(typeof data.remoteAvailable === 'boolean', 'Invalid remote preference');
				filters.remoteAvailable = data.remoteAvailable;
			}
			if (data.query !== undefined) {
				check(
					typeof data.query === 'string' && data.query.trim().length > 0 && data.query.length <= 200,
					'Invalid assistant query',
				);
				filters.query = data.query.trim();
			}
			if (data.budgetMax !== undefined) {
				check(
					typeof data.budgetMax === 'number' &&
						Number.isInteger(data.budgetMax) &&
						data.budgetMax >= 0 &&
						data.budgetMax <= 1000000000,
					'Invalid assistant budget',
				);
				filters.budgetMax = data.budgetMax;
			}
			mode = 'AI';
		} else {
			const text = request.toLowerCase();
			const category = categories.find((item) =>
				[item.slug.replace(/-/g, ' '), item.name.toLowerCase()].some((term) => text.includes(term)),
			);
			const city = CITIES.find((item) =>
				[item.key, item.nameKo, item.nameEn.toLowerCase()].some((term) => text.includes(term)),
			);
			if (category) filters.categoryId = String(category._id);
			if (city) filters.city = city.key;
			if (/remote|원격|재택/.test(text)) filters.remoteAvailable = true;
			if (!category && !city && filters.remoteAvailable === undefined) filters.query = request.slice(0, 200);
		}
		const [creators, projects, services] = await Promise.all([
			this.discovery.getCreators(filters),
			this.discovery.getProjects(filters),
			this.discovery.getServices(filters),
		]);
		return {
			mode,
			explanation: `${mode === 'AI' ? 'AI-extracted' : 'Keyword-based'} filters applied to public content. Custom-quote services require a quote; their price is unknown.`,
			creators: creators.list,
			projects: projects.list,
			services: services.list,
		};
	}
}
