import { invalidate } from '$app/navigation';
import { createSupabaseBrowserClient } from '$lib/supabase/client';

createSupabaseBrowserClient().auth.onAuthStateChange(() => {
	invalidate('supabase:auth');
});
