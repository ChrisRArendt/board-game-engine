import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { dmSheetConversationId } from '$lib/stores/dmSheet';

const SHEET_MAX_WIDTH = '(max-width: 768px)';

/**
 * Open a DM: bottom sheet on narrow viewports, full page on desktop.
 * Use after `openConversationWith` (or whenever you already have a conversation id).
 */
export function openConversationUi(conversationId: string) {
	if (browser && typeof window !== 'undefined' && window.matchMedia(SHEET_MAX_WIDTH).matches) {
		dmSheetConversationId.set(conversationId);
	} else {
		void goto(`/messages/${conversationId}`);
	}
}
