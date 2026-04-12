export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type EmptyRel = [];

export interface Database {
	public: {
		Tables: {
			profiles: {
				Row: {
					id: string;
					username: string;
					display_name: string;
					avatar_url: string | null;
					created_at: string;
				};
				Insert: {
					id: string;
					username: string;
					display_name: string;
					avatar_url?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					username?: string;
					display_name?: string;
					avatar_url?: string | null;
					created_at?: string;
				};
				Relationships: EmptyRel;
			};
			friendships: {
				Row: {
					id: string;
					requester_id: string;
					addressee_id: string;
					status: 'pending' | 'accepted' | 'blocked';
					created_at: string;
				};
				Insert: {
					id?: string;
					requester_id: string;
					addressee_id: string;
					status?: 'pending' | 'accepted' | 'blocked';
					created_at?: string;
				};
				Update: {
					id?: string;
					requester_id?: string;
					addressee_id?: string;
					status?: 'pending' | 'accepted' | 'blocked';
					created_at?: string;
				};
				Relationships: EmptyRel;
			};
			lobbies: {
				Row: {
					id: string;
					host_id: string;
					game_key: string;
					name: string;
					status: 'waiting' | 'playing' | 'finished';
					max_players: number;
					invite_code: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					host_id: string;
					game_key: string;
					name: string;
					status?: 'waiting' | 'playing' | 'finished';
					max_players?: number;
					invite_code: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					host_id?: string;
					game_key?: string;
					name?: string;
					status?: 'waiting' | 'playing' | 'finished';
					max_players?: number;
					invite_code?: string;
					created_at?: string;
				};
				Relationships: EmptyRel;
			};
			lobby_members: {
				Row: {
					lobby_id: string;
					user_id: string;
					joined_at: string;
					sort_order: number;
				};
				Insert: {
					lobby_id: string;
					user_id: string;
					joined_at?: string;
					sort_order?: number;
				};
				Update: {
					lobby_id?: string;
					user_id?: string;
					joined_at?: string;
					sort_order?: number;
				};
				Relationships: EmptyRel;
			};
		};
		Views: Record<string, never>;
		Functions: {
			set_lobby_member_order: {
				Args: { p_lobby_id: string; p_user_ids: string[] };
				Returns: undefined;
			};
		};
		Enums: Record<string, never>;
		CompositeTypes: Record<string, never>;
	};
}

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
