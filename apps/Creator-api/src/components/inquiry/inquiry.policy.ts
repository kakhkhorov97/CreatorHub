import { InquiryOutcome } from '../../libs/enums/inquiry-outcome.enum';
import { InquiryStatus } from '../../libs/enums/inquiry-status.enum';
import { check } from '../../libs/helpers/policy';

export type InquiryAction = 'SUBMIT' | 'MESSAGE' | 'DECLINE' | 'CANCEL' | 'CLOSE';

export function nextInquiryStatus(
	status: InquiryStatus,
	action: InquiryAction,
	isClient: boolean,
	outcome?: InquiryOutcome,
	submittedAt?: Date,
	now = new Date(),
): InquiryStatus {
	if (action === 'SUBMIT') {
		check(isClient && status === InquiryStatus.DRAFT, 'Only the client can submit a draft');
		return InquiryStatus.SENT;
	}
	check(
		status === InquiryStatus.SENT || status === InquiryStatus.IN_DISCUSSION,
		'This inquiry does not accept further changes',
	);
	if (action === 'MESSAGE') return isClient ? status : InquiryStatus.IN_DISCUSSION;
	if (action === 'DECLINE') {
		check(!isClient && status === InquiryStatus.SENT, 'Only the creator can decline an unanswered inquiry');
		return InquiryStatus.DECLINED;
	}
	if (action === 'CANCEL') {
		check(isClient && status === InquiryStatus.SENT, 'Only the client can cancel an unanswered inquiry');
		return InquiryStatus.CANCELLED;
	}
	check(isClient || status === InquiryStatus.IN_DISCUSSION, 'The creator must reply before closing an inquiry');
	check(outcome !== undefined, 'Closing requires an outcome');
	check(outcome !== InquiryOutcome.COMPLETED, 'Mark work completed after closing with agreement');
	if (outcome === InquiryOutcome.AGREED_TO_PROCEED)
		check(status === InquiryStatus.IN_DISCUSSION, 'Agreement requires a discussion');
	if (outcome === InquiryOutcome.NO_RESPONSE)
		check(
			isClient && status === InquiryStatus.SENT && submittedAt && now.getTime() - submittedAt.getTime() >= 7 * 86400000,
			'No response is available after seven days without a creator reply',
		);
	return InquiryStatus.CLOSED;
}
