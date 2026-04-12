import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/database.types';

declare global {
	namespace App {
		interface Error {}
		interface Locals {
			supabase: SupabaseClient<Database>;
			safeGetSession: () => Promise<{ session: Session | null }>;
		}
		interface PageData {
			session: Session | null;
		}
		interface PageState {}
		interface Platform {}
	}
}

export {};
