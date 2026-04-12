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
				};
				Insert: {
					lobby_id: string;
					user_id: string;
					joined_at?: string;
				};
				Update: {
					lobby_id?: string;
					user_id?: string;
					joined_at?: string;
				};
				Relationships: EmptyRel;
			};
		};
		Views: Record<string, never>;
		Functions: Record<string, never>;
		Enums: Record<string, never>;
		CompositeTypes: Record<string, never>;
	};
}

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
