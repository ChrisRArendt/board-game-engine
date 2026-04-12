<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import Board from '$lib/components/Board.svelte';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import ContextMenu from '$lib/components/ContextMenu.svelte';
	import UserList from '$lib/components/UserList.svelte';
	import WindowFrame from '$lib/components/windows/WindowFrame.svelte';
	import DiceRoller from '$lib/components/windows/DiceRoller.svelte';
	import Connection from '$lib/components/windows/Connection.svelte';
	import Settings from '$lib/components/windows/Settings.svelte';
	import CardViewer from '$lib/components/windows/CardViewer.svelte';
	import type { GameDataJson } from '$lib/engine/types';
	import * as g from '$lib/stores/game';
	import { game } from '$lib/stores/game';
	import { registerGameEmit } from '$lib/stores/game';
	import { settings } from '$lib/stores/settings';
	import { emit, connectGameChannel, disconnectGame, getLocalPlayerColor } from '$lib/stores/network';
	import { appendRollerLine } from '$lib/stores/rollerLog';
	import { isZoomMinusKey, isZoomPlusKey } from '$lib/engine/input';
	import { getViewportSize } from '$lib/engine/geometry';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import { endGame } from '$lib/lobby';
	import type { Json } from '$lib/supabase/database.types';
	import type { PageData } from './$types';
	import { browser } from '$app/environment';

	export let data: PageData;

	const supabase = createSupabaseBrowserClient();

	/**
	 * Prefer order agreed in the lobby at “Start game” (sessionStorage) over SSR `lobby_members`
	 * when PostgREST/DB order lags behind what players saw after reordering.
	 */
	function memberOrderForPlay(lobbyId: string, serverOrder: string[]): string[] {
		if (!browser) return serverOrder;
		const key = `bge:member_order:${lobbyId}`;
		try {
			const raw = sessionStorage.getItem(key);
			if (!raw) return serverOrder;
			const parsed = JSON.parse(raw) as string[];
			if (!Array.isArray(parsed) || parsed.length === 0) return serverOrder;
			const fromServer = new Set(serverOrder);
			if (parsed.length !== serverOrder.length || !parsed.every((id) => fromServer.has(id))) {
				return serverOrder;
			}
			sessionStorage.removeItem(key);
			return parsed;
		} catch {
			return serverOrder;
		}
	}

	let ctxOpen = false;
	let ctxX = 0;
	let ctxY = 0;

	let winRoller = false;
	let winConn = false;
	let winSettings = false;
	let winViewer = false;
	let viewerPieceId: number | null = null;

	let unsubAutosave: (() => void) | undefined;

	/** Local enlarged piece preview only — never broadcast (unlike Dice Roller). */
	function openLocalViewerFromSelection() {
		const sel = get(game).pieces.filter((p) => get(game).selectedIds.has(p.id));
		viewerPieceId = sel.length ? sel[0].id : null;
		winViewer = true;
	}

	function openLocalViewerForPiece(id: number) {
		viewerPieceId = id;
		winViewer = true;
	}

	function focalCenter() {
		const vp = getViewportSize();
		return { left: vp.w / 2 + window.scrollX, top: vp.h / 2 + window.scrollY };
	}

	async function persistSnapshot() {
		if (!get(game).loaded) return;
		const payload = g.serializeGameState();
		const { error } = await supabase.from('game_snapshots').upsert(
			{
				lobby_id: data.lobby.id,
				snapshot: payload as unknown as Json,
				saved_by: data.session.user.id,
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'lobby_id' }
		);
		if (error) console.error('[bge] snapshot save', error);
	}

	async function hostEndGame() {
		if (!data.isHost) return;
		if (!confirm('End this game for everyone?')) return;
		try {
			await endGame(supabase, data.lobby.id, data.session.user.id);
			emit('game_end', {});
			disconnectGame();
			await goto('/lobby');
		} catch (e) {
			console.error('[bge] end game', e);
		}
	}

	function onKeyDown(e: KeyboardEvent) {
		if (isZoomMinusKey(e)) {
			e.preventDefault();
			g.adjustZoom(-1, focalCenter());
		} else if (isZoomPlusKey(e)) {
			e.preventDefault();
			g.adjustZoom(1, focalCenter());
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			g.applyPanDelta(100, 0);
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			g.applyPanDelta(-100, 0);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			g.applyPanDelta(0, 100);
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			g.applyPanDelta(0, -100);
		} else if (e.key === 'Shift') {
			g.setShiftDown(true);
		} else if (e.key === 'd' || e.key === 'D') {
			const sel = get(game).pieces.filter((p) => get(game).selectedIds.has(p.id));
			if (sel.every((p) => p.attributes.includes('duplicate'))) sel.forEach((p) => g.duplicatePiece(p.id));
		} else if (e.key === 'f' || e.key === 'F') {
			const sel = get(game).pieces.filter((p) => get(game).selectedIds.has(p.id));
			if (sel.every((p) => p.attributes.includes('flip'))) sel.forEach((p) => g.flipPiece(p.id));
		} else if (e.key === 's' || e.key === 'S') {
			const sel = get(game).pieces.filter((p) => get(game).selectedIds.has(p.id));
			if (sel.length > 1 && sel.every((p) => p.attributes.includes('shuffle'))) g.runShuffleSelected();
		} else if (e.key === 'a' || e.key === 'A') {
			g.runArrangeSmart();
		} else if (e.key === 'Backspace') {
			const sel = get(game).pieces.filter((p) => get(game).selectedIds.has(p.id));
			if (sel.every((p) => p.attributes.includes('destroy'))) sel.forEach((p) => g.destroyPiece(p.id));
		}
	}

	function onKeyUp(e: KeyboardEvent) {
		if (e.key === 'Shift') g.setShiftDown(false);
	}

	function onContextMenu(e: MouseEvent) {
		e.preventDefault();
		ctxX = e.clientX;
		ctxY = e.clientY;
		ctxOpen = true;
	}

	function onDocClick() {
		ctxOpen = false;
	}

	onMount(() => {
		registerGameEmit((type, payload) => {
			if (type === 'piece_select') {
				emit(type, { ...payload, color: getLocalPlayerColor() });
			} else {
				emit(type, payload);
			}
		});

		const onGameEndEv = () => {
			disconnectGame();
			void goto('/lobby');
		};
		window.addEventListener('bge:game_end', onGameEndEv);

		const onRollerRoll = ((ev: CustomEvent) => {
			const d = ev.detail as {
				rollId: string;
				result: string | number;
				datestr: string;
				name?: string;
			};
			if (!d?.rollId) return;
			const label = d.name ? `${d.result} (${d.name})` : String(d.result);
			appendRollerLine(d.rollId, label, d.datestr);
		}) as EventListener;

		const onWindowOpen = ((ev: CustomEvent) => {
			const w = ev.detail?.winid as string;
			if (w === 'window_roller') winRoller = true;
		}) as EventListener;

		window.addEventListener('bge:roller_roll', onRollerRoll);
		window.addEventListener('bge:window_open', onWindowOpen);
		window.addEventListener('click', onDocClick);

		void (async () => {
			if (data.profile) {
				try {
					await connectGameChannel(
						data.lobby.id,
						{
							userId: data.session.user.id,
							displayName: data.profile.display_name,
							avatarUrl: data.profile.avatar_url
						},
						{ memberOrderIds: memberOrderForPlay(data.lobby.id, data.memberOrderIds) }
					);
				} catch (e) {
					console.error('[bge] realtime', e);
				}
			}

			const snap = data.storedSnapshot;
			if (snap && g.isStoredGameSnapshot(snap)) {
				g.applyStoredGameSnapshot(snap);
			} else {
				const r = await fetch(`/data/${data.lobby.game_key}/pieces.json`);
				const j = (await r.json()) as GameDataJson;
				g.loadGameData(j);
				g.centerCamToVP();
				await persistSnapshot();
			}

			unsubAutosave = g.subscribeGameSnapshotAutosave(() => {
				void persistSnapshot();
			});
		})();

		return () => {
			window.removeEventListener('click', onDocClick);
			window.removeEventListener('bge:roller_roll', onRollerRoll);
			window.removeEventListener('bge:window_open', onWindowOpen);
			window.removeEventListener('bge:game_end', onGameEndEv);
			unsubAutosave?.();
		};
	});

	onDestroy(() => {
		disconnectGame();
	});
</script>

<svelte:window on:keydown={onKeyDown} on:keyup={onKeyUp} on:contextmenu={onContextMenu} />

<Toolbar
	curGame={$game.curGame}
	roller={() => {
		winRoller = true;
		emit('window_open', { winid: 'window_roller' });
	}}
	viewer={openLocalViewerFromSelection}
	openSettings={() => (winSettings = true)}
	openConnection={() => (winConn = true)}
	onEndGame={data.isHost ? hostEndGame : null}
/>

<Board
	zoomWithScroll={$settings.zoomWithScroll}
	panScreenEdge={$settings.panScreenEdge}
	onOpenViewer={openLocalViewerForPiece}
/>

<UserList
	selfUserId={data.session.user.id}
	selfDisplayName={data.profile?.display_name ?? 'You'}
	selfAvatarUrl={data.profile?.avatar_url}
/>

<ContextMenu bind:open={ctxOpen} x={ctxX} y={ctxY} />

<WindowFrame title="Dice Roller" open={winRoller} onclose={() => (winRoller = false)}>
	<DiceRoller rollerName={data.profile?.display_name ?? 'Player'} />
</WindowFrame>

<WindowFrame title="Connection" open={winConn} onclose={() => (winConn = false)}>
	<Connection />
</WindowFrame>

<WindowFrame title="Settings" open={winSettings} onclose={() => (winSettings = false)}>
	<Settings />
</WindowFrame>

<WindowFrame
	title="Viewer (local)"
	open={winViewer}
	onclose={() => {
		winViewer = false;
		viewerPieceId = null;
	}}
>
	<CardViewer bind:targetPieceId={viewerPieceId} />
</WindowFrame>
