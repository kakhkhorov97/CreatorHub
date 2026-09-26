import { InquiryOutcome as Outcome, InquiryStatus as Status } from '../../libs/enums/creatorhub.enum';
import { nextInquiryStatus } from './inquiry.policy';

describe('inquiry lifecycle boundaries', () => {
	it.each([Status.CLOSED, Status.DECLINED, Status.CANCELLED])('does not reopen or accept messages in %s', (status) => {
		expect(() => nextInquiryStatus(status, 'MESSAGE', true)).toThrow();
		expect(() => nextInquiryStatus(status, 'SUBMIT', true)).toThrow();
	});

	it('requires discussion before recording agreement', () => {
		expect(() => nextInquiryStatus(Status.SENT, 'CLOSE', true, Outcome.AGREED_TO_PROCEED)).toThrow();
		expect(nextInquiryStatus(Status.IN_DISCUSSION, 'CLOSE', false, Outcome.AGREED_TO_PROCEED)).toBe(Status.CLOSED);
	});

	it('allows no-response closure exactly at the seven-day boundary', () => {
		const submitted = new Date('2026-09-01T00:00:00Z');
		expect(() =>
			nextInquiryStatus(
				Status.SENT,
				'CLOSE',
				true,
				Outcome.NO_RESPONSE,
				submitted,
				new Date('2026-09-07T23:59:59.999Z'),
			),
		).toThrow();
		expect(
			nextInquiryStatus(Status.SENT, 'CLOSE', true, Outcome.NO_RESPONSE, submitted, new Date('2026-09-08T00:00:00Z')),
		).toBe(Status.CLOSED);
	});

	it('restricts decline and cancel to their respective participant and state', () => {
		expect(() => nextInquiryStatus(Status.SENT, 'DECLINE', true)).toThrow();
		expect(() => nextInquiryStatus(Status.SENT, 'CANCEL', false)).toThrow();
		expect(() => nextInquiryStatus(Status.IN_DISCUSSION, 'CANCEL', true)).toThrow();
		expect(() => nextInquiryStatus(Status.IN_DISCUSSION, 'DECLINE', false)).toThrow();
	});
});
