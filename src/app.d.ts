import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { Database, ProfileRow } from '$lib/supabase/database.types';

declare global {
	namespace App {
		interface Error {}
		interface Locals {
			supabase: SupabaseClient<Database>;
			safeGetSession: () => Promise<{ session: Session | null }>;
		}
		interface PageData {
			session: Session | null;
			profile: ProfileRow | null;
		}
		interface PageState {}
		interface Platform {}
	}
}

export {};
