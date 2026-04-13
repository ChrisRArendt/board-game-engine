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
					/** Hex `#rrggbb` or null = automatic hue from user id */
					player_color: string | null;
					created_at: string;
				};
				Insert: {
					id: string;
					username: string;
					display_name: string;
					avatar_url?: string | null;
					player_color?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					username?: string;
					display_name?: string;
					avatar_url?: string | null;
					player_color?: string | null;
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
			game_snapshots: {
				Row: {
					lobby_id: string;
					snapshot: Json;
					saved_by: string;
					updated_at: string;
				};
				Insert: {
					lobby_id: string;
					snapshot: Json;
					saved_by: string;
					updated_at?: string;
				};
				Update: {
					lobby_id?: string;
					snapshot?: Json;
					saved_by?: string;
					updated_at?: string;
				};
				Relationships: EmptyRel;
			};
			game_history_snapshots: {
				Row: {
					id: number;
					lobby_id: string;
					snapshot: Json;
					saved_by: string;
					created_at: string;
				};
				Insert: {
					id?: never;
					lobby_id: string;
					snapshot: Json;
					saved_by: string;
					created_at?: string;
				};
				Update: {
					id?: number;
					lobby_id?: string;
					snapshot?: Json;
					saved_by?: string;
					created_at?: string;
				};
				Relationships: EmptyRel;
			};
			friend_voice_settings: {
				Row: {
					user_id: string;
					friend_id: string;
					volume: number;
					muted: boolean;
				};
				Insert: {
					user_id: string;
					friend_id: string;
					volume?: number;
					muted?: boolean;
				};
				Update: {
					user_id?: string;
					friend_id?: string;
					volume?: number;
					muted?: boolean;
				};
				Relationships: EmptyRel;
			};
			custom_board_games: {
				Row: {
					id: string;
					creator_id: string;
					title: string;
					description: string;
					game_key: string;
					game_data: Json;
					rules_pdf_path: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					creator_id: string;
					title: string;
					description?: string;
					game_data: Json;
					rules_pdf_path?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					creator_id?: string;
					title?: string;
					description?: string;
					game_data?: Json;
					rules_pdf_path?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: EmptyRel;
			};
			card_templates: {
				Row: {
					id: string;
					game_id: string;
					name: string;
					canvas_width: number;
					canvas_height: number;
					border_radius: number;
					frame_border_width: number;
					frame_border_color: string;
					frame_inner_radius: number | null;
					background: Json;
					layers: Json;
					back_background: Json | null;
					back_layers: Json | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					game_id: string;
					name: string;
					canvas_width: number;
					canvas_height: number;
					border_radius?: number;
					frame_border_width?: number;
					frame_border_color?: string;
					frame_inner_radius?: number | null;
					background?: Json;
					layers?: Json;
					back_background?: Json | null;
					back_layers?: Json | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					game_id?: string;
					name?: string;
					canvas_width?: number;
					canvas_height?: number;
					border_radius?: number;
					frame_border_width?: number;
					frame_border_color?: string;
					frame_inner_radius?: number | null;
					background?: Json;
					layers?: Json;
					back_background?: Json | null;
					back_layers?: Json | null;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: EmptyRel;
			};
			card_instances: {
				Row: {
					id: string;
					template_id: string;
					game_id: string;
					name: string;
					field_values: Json;
					rendered_image_path: string | null;
					render_stale: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					template_id: string;
					game_id: string;
					name?: string;
					field_values?: Json;
					rendered_image_path?: string | null;
					render_stale?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					template_id?: string;
					game_id?: string;
					name?: string;
					field_values?: Json;
					rendered_image_path?: string | null;
					render_stale?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Relationships: EmptyRel;
			};
			game_media: {
				Row: {
					id: string;
					game_id: string;
					creator_id: string;
					file_path: string;
					filename: string;
					source_type: 'upload' | 'ai_generated';
					ai_prompt: string | null;
					width: number | null;
					height: number | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					game_id: string;
					creator_id: string;
					file_path: string;
					filename: string;
					source_type: 'upload' | 'ai_generated';
					ai_prompt?: string | null;
					width?: number | null;
					height?: number | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					game_id?: string;
					creator_id?: string;
					file_path?: string;
					filename?: string;
					source_type?: 'upload' | 'ai_generated';
					ai_prompt?: string | null;
					width?: number | null;
					height?: number | null;
					created_at?: string;
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
