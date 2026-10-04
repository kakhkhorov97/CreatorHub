import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class City {
	@Field()
	key!: string;

	@Field()
	nameEn!: string;

	@Field()
	nameKo!: string;
}
// Supported cities. Keys are stable; this is deliberately not a database enum.

export const CITIES: City[] = [
	{ key: 'seoul', nameEn: 'Seoul', nameKo: '서울' },
	{ key: 'busan', nameEn: 'Busan', nameKo: '부산' },
	{ key: 'incheon', nameEn: 'Incheon', nameKo: '인천' },
	{ key: 'daegu', nameEn: 'Daegu', nameKo: '대구' },
	{ key: 'daejeon', nameEn: 'Daejeon', nameKo: '대전' },
	{ key: 'gwangju', nameEn: 'Gwangju', nameKo: '광주' },
	{ key: 'ulsan', nameEn: 'Ulsan', nameKo: '울산' },
	{ key: 'sejong', nameEn: 'Sejong', nameKo: '세종' },
	{ key: 'suwon', nameEn: 'Suwon', nameKo: '수원' },
	{ key: 'seongnam', nameEn: 'Seongnam', nameKo: '성남' },
	{ key: 'goyang', nameEn: 'Goyang', nameKo: '고양' },
	{ key: 'yongin', nameEn: 'Yongin', nameKo: '용인' },
	{ key: 'changwon', nameEn: 'Changwon', nameKo: '창원' },
	{ key: 'cheongju', nameEn: 'Cheongju', nameKo: '청주' },
	{ key: 'jeonju', nameEn: 'Jeonju', nameKo: '전주' },
	{ key: 'chuncheon', nameEn: 'Chuncheon', nameKo: '춘천' },
	{ key: 'jeju', nameEn: 'Jeju', nameKo: '제주' },
];
