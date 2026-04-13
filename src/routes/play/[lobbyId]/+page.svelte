<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { goto } from '$app/navigation';
	import Board from '$lib/components/Board.svelte';
	import HistorySlider from '$lib/components/HistorySlider.svelte';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import ContextMenu from '$lib/components/ContextMenu.svelte';
	import UserList from '$lib/components/UserList.svelte';
	import WindowFrame from '$lib/components/windows/WindowFrame.svelte';
	import BottomSheet from '$lib/components/windows/BottomSheet.svelte';
	import DiceRoller from '$lib/components/windows/DiceRoller.svelte';
	import Connection from '$lib/components/windows/Connection.svelte';
	import Settings from '$lib/components/windows/Settings.svelte';
	import CardViewer from '$lib/components/windows/CardViewer.svelte';
	import type { GameDataJson } from '$lib/engine/types';
	import * as g from '$lib/stores/game';
	import { game } from '$lib/stores/game';
	import { registerGameEmit } from '$lib/stores/game';
	import { settings } from '$lib/stores/settings';
	import {
		emit,
		connectGameChannel,
		disconnectGame,
		getLocalPlayerColor,
		requestStateSyncFromPeers
	} from '$lib/stores/network';
	import {
		configureHistoryRecording,
		initRecordingBaseline,
		tryRecordHistorySnapshot,
		HISTORY_RECORD_INTERVAL_MS,
		syncOpenReplayFromRemote,
		remoteCloseReplay,
		scrubToIndexRemote,
		remoteRestoreFromHistoryId,
		exitReplay,
		isHistoryReplayActive,
		toggleHistoryReplay
	} from '$lib/stores/history';
	import {
		computeGrandTotalFromDice,
		computeRollTotal,
		faceCountsFromDice,
		type DieTabId,
		type RolledDie
	} from '$lib/engine/diceRoll';
	import { appendPoolRoll, appendRollerLine, appendRollerRoll } from '$lib/stores/rollerLog';
	import { isTypingInField, isZoomMinusKey, isZoomPlusKey } from '$lib/engine/input';
	import { getViewportSize } from '$lib/engine/geometry';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import { loadFriendVoicePrefsFromSupabase, registerFriendVoiceSaver } from '$lib/stores/voiceSettings';
	import { leaveVoiceRoom, tryAutoJoinVoice } from '$lib/stores/voiceChat';
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
	let winMenuSheet = false;
	let useMobileSheets = false;
	let removeMobileMq: (() => void) | undefined;
	let viewerPieceId: number | null = null;
	/** When true, board clicks do not change the viewer preview (locked to `viewerPieceId`). */
	let viewerLocked = false;

	let unsubAutosave: (() => void) | undefined;
	let historyRecordInterval: ReturnType<typeof setInterval> | undefined;
	/** Used to fit `initial_play_view` in the visible area below the fixed top bar (not under it). */
	let playTopbarH = 0;

	$: rulesUrlForMenu = data.customGame
		? data.customGame.rulesUrl
		: `/data/${$game.curGame}/rules.pdf`;

	/** Local enlarged piece preview only — never broadcast (unlike Dice Roller). */
	function openLocalViewerFromSelection() {
		const sel = get(game).pieces.filter((p) => get(game).selectedIds.has(p.id));
		viewerPieceId = sel.length ? sel[0].id : null;
		viewerLocked = false;
		winViewer = true;
	}

	function openLocalViewerForPiece(id: number) {
		viewerPieceId = id;
		viewerLocked = false;
		winViewer = true;
	}

	function followViewerToPiece(pieceId: number) {
		if (!winViewer || viewerLocked) return;
		viewerPieceId = pieceId;
	}

	function openRollerWindow() {
		winRoller = true;
		try {
			emit('window_open', { winid: 'window_roller' });
		} catch (e) {
			console.warn('[bge] window_open broadcast failed', e);
		}
	}

	function focalCenter() {
		const vp = getViewportSize();
		return { x: vp.w / 2, y: vp.h / 2 };
	}

	async function onToolbarToggleHistory() {
		await toggleHistoryReplay(supabase, data.lobby.id, emit);
	}

	function openContextFromLongPress(clientX: number, clientY: number) {
		ctxX = clientX;
		ctxY = clientY;
		ctxOpen = true;
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
			await leaveVoiceRoom();
			await goto('/lobby');
		} catch (e) {
			console.error('[bge] end game', e);
		}
	}

	function onKeyDown(e: KeyboardEvent) {
		if (get(isHistoryReplayActive)) {
			if (e.key === 'Escape') {
				e.preventDefault();
				exitReplay();
				emit('history_close', {});
				return;
			}
			return;
		}
		if (e.key === ' ' || e.code === 'Space') {
			if (isTypingInField(e.target)) return;
			e.preventDefault();
			if (!e.repeat) g.setSpacePanHeld(true);
			return;
		}
		if (isZoomMinusKey(e)) {
			e.preventDefault();
			g.adjustZoomByStep(-1, focalCenter());
		} else if (isZoomPlusKey(e)) {
			e.preventDefault();
			g.adjustZoomByStep(1, focalCenter());
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
		else if (e.key === ' ' || e.code === 'Space') {
			g.setSpacePanHeld(false);
			g.endPanPointer();
		}
	}

	function onContextMenu(e: MouseEvent) {
		if (get(isHistoryReplayActive)) {
			e.preventDefault();
			return;
		}
		e.preventDefault();
		ctxX = e.clientX;
		ctxY = e.clientY;
		ctxOpen = true;
	}

	function onDocClick(e: MouseEvent) {
		const raw = e.target;
		const el =
			raw instanceof Element ? raw : raw instanceof Node ? raw.parentElement : null;
		if (el?.closest?.('[data-toolbar]')) return;
		ctxOpen = false;
	}

	onMount(() => {
		if (browser) {
			const mq = window.matchMedia('(max-width: 639px)');
			useMobileSheets = mq.matches;
			const fn = () => {
				useMobileSheets = mq.matches;
			};
			mq.addEventListener('change', fn);
			removeMobileMq = () => mq.removeEventListener('change', fn);
		}

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
				kind?: string;
				rollId?: string;
				datestr: string;
				name?: string;
				result?: string | number;
				results?: (string | number)[];
				total?: number | null;
				dice?: RolledDie[];
				segments?: { tab: string; results: (string | number)[]; total: number | null }[];
				grandTotal?: number | null;
				faceCounts?: Record<string, number>;
			};
			if (!d?.datestr) return;
			winRoller = true;
			if (
				d.kind === 'pool' &&
				Array.isArray(d.dice) &&
				d.dice.length > 0 &&
				Array.isArray(d.segments) &&
				d.segments.length > 0
			) {
				const grandTotal =
					d.grandTotal !== undefined && d.grandTotal !== null
						? d.grandTotal
						: computeGrandTotalFromDice(d.dice);
				const faceCounts =
					d.faceCounts && Object.keys(d.faceCounts).length > 0
						? d.faceCounts
						: faceCountsFromDice(d.dice);
				appendPoolRoll(d.segments, grandTotal, faceCounts, d.datestr, d.name);
				return;
			}
			if (d.rollId && Array.isArray(d.results) && d.results.length > 0) {
				const total =
					d.total !== undefined && d.total !== null
						? d.total
						: computeRollTotal(d.rollId as DieTabId, d.results);
				appendRollerRoll(d.rollId, d.results, total, d.datestr, d.name);
			} else if (d.rollId && d.result !== undefined) {
				const label = d.name ? `${d.result} (${d.name})` : String(d.result);
				appendRollerLine(d.rollId, label, d.datestr);
			}
		}) as EventListener;

		const onWindowOpen = ((ev: CustomEvent) => {
			const w = ev.detail?.winid as string;
			if (w === 'window_roller') winRoller = true;
		}) as EventListener;

		window.addEventListener('bge:roller_roll', onRollerRoll);
		window.addEventListener('bge:window_open', onWindowOpen);
		window.addEventListener('click', onDocClick);

		const onHistoryOpen = ((ev: CustomEvent) => {
			const d = ev.detail as { index?: number };
			const idx = typeof d?.index === 'number' ? d.index : 0;
			void syncOpenReplayFromRemote(supabase, data.lobby.id, idx);
		}) as EventListener;

		const onHistoryScrub = ((ev: CustomEvent) => {
			const d = ev.detail as { index?: number };
			if (typeof d?.index === 'number') scrubToIndexRemote(d.index);
		}) as EventListener;

		const onHistoryClose = () => {
			remoteCloseReplay();
		};

		const onHistoryRestore = ((ev: CustomEvent) => {
			const d = ev.detail as { historyId?: number };
			if (typeof d?.historyId !== 'number') return;
			void remoteRestoreFromHistoryId(supabase, data.lobby.id, d.historyId, persistSnapshot);
		}) as EventListener;

		window.addEventListener('bge:history_open', onHistoryOpen);
		window.addEventListener('bge:history_scrub', onHistoryScrub);
		window.addEventListener('bge:history_close', onHistoryClose);
		window.addEventListener('bge:history_restore', onHistoryRestore);

		void (async () => {
			registerFriendVoiceSaver(supabase);
			await loadFriendVoicePrefsFromSupabase(supabase, data.session.user.id);
			if (data.profile) {
				tryAutoJoinVoice(data.lobby.id, {
					userId: data.session.user.id,
					displayName: data.profile.display_name
				});
			}
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
				/** Older DB snapshots only had pieces/zoom/pan — restore table media, zones, initial view from game JSON. */
				if (g.snapshotNeedsLayoutHydration(snap)) {
					if (data.customGame) {
						g.mergeGameLayoutFromGameData(data.customGame.gameData, {
							assetBaseUrl: data.customGame.assetBaseUrl
						});
					} else {
						const r = await fetch(`/data/${data.lobby.game_key}/pieces.json`);
						const j = (await r.json()) as GameDataJson;
						g.mergeGameLayoutFromGameData(j, { assetBaseUrl: null });
					}
				}
			} else if (data.customGame) {
				g.loadGameData(data.customGame.gameData, {
					curGame: data.lobby.game_key,
					assetBaseUrl: data.customGame.assetBaseUrl,
					stripEditorOnly: true
				});
				g.centerCamToVP();
				await persistSnapshot();
			} else {
				const r = await fetch(`/data/${data.lobby.game_key}/pieces.json`);
				const j = (await r.json()) as GameDataJson;
				g.loadGameData(j, { stripEditorOnly: true });
				g.centerCamToVP();
				await persistSnapshot();
			}

			unsubAutosave = g.subscribeGameSnapshotAutosave(() => {
				void persistSnapshot();
			});

			/** Catch up with live board after refresh — DB snapshot can lag Realtime; peers hold truth. */
			setTimeout(() => requestStateSyncFromPeers(), 400);
			setTimeout(() => requestStateSyncFromPeers(), 2000);

			configureHistoryRecording({
				lobbyId: data.lobby.id,
				userId: data.session.user.id,
				supabase
			});
			initRecordingBaseline();
			historyRecordInterval = setInterval(() => {
				void tryRecordHistorySnapshot();
			}, HISTORY_RECORD_INTERVAL_MS);
		})();

		return () => {
			removeMobileMq?.();
			window.removeEventListener('click', onDocClick);
			window.removeEventListener('bge:roller_roll', onRollerRoll);
			window.removeEventListener('bge:window_open', onWindowOpen);
			window.removeEventListener('bge:game_end', onGameEndEv);
			unsubAutosave?.();
			if (historyRecordInterval) clearInterval(historyRecordInterval);
			window.removeEventListener('bge:history_open', onHistoryOpen);
			window.removeEventListener('bge:history_scrub', onHistoryScrub);
			window.removeEventListener('bge:history_close', onHistoryClose);
			window.removeEventListener('bge:history_restore', onHistoryRestore);
		};
	});

	onDestroy(() => {
		disconnectGame();
	});
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} oncontextmenu={onContextMenu} />

<div class="play-topbar" bind:clientHeight={playTopbarH}>
	<Toolbar
		curGame={$game.curGame}
		rulesUrl={data.customGame ? data.customGame.rulesUrl : undefined}
		onOpenRoller={openRollerWindow}
		onOpenViewer={openLocalViewerFromSelection}
		onOpenSettings={() => {
			if (useMobileSheets) winMenuSheet = false;
			winSettings = true;
		}}
		onOpenConnection={() => {
			if (useMobileSheets) winMenuSheet = false;
			winConn = true;
		}}
		voiceLobbyId={data.lobby.id}
		voiceUserId={data.session.user.id}
		voiceDisplayName={data.profile?.display_name ?? 'You'}
		onEndGame={data.isHost ? hostEndGame : null}
		onToggleHistory={onToolbarToggleHistory}
		historyReplayActive={$isHistoryReplayActive}
		onOpenMenu={() => (winMenuSheet = true)}
	/>
	<HistorySlider lobbyId={data.lobby.id} {supabase} onPersistSnapshot={persistSnapshot} />
</div>

<Board
	selfUserId={data.session.user.id}
	selfDisplayName={data.profile?.display_name ?? 'You'}
	scrollWheelPans={$settings.scrollWheelPans}
	panScreenEdge={$settings.panScreenEdge}
	replayMode={$isHistoryReplayActive}
	onOpenViewer={openLocalViewerForPiece}
	onViewerFollowPiece={followViewerToPiece}
	onOpenContextMenu={openContextFromLongPress}
	initialPlayFitInset={playTopbarH > 0 ? { top: playTopbarH } : undefined}
/>

<UserList
	selfUserId={data.session.user.id}
	selfDisplayName={data.profile?.display_name ?? 'You'}
	selfAvatarUrl={data.profile?.avatar_url}
/>

<ContextMenu
	bind:open={ctxOpen}
	x={ctxX}
	y={ctxY}
	selfDisplayName={data.profile?.display_name ?? 'You'}
/>

<!-- Fixed layer above the board; pointer-events none so table still receives drags except on windows/sheets. -->
<div class="play-overlay-root">
	{#if useMobileSheets}
		<BottomSheet title="Menu" visible={winMenuSheet} requestClose={() => (winMenuSheet = false)}>
			<ul class="play-menu">
				{#if rulesUrlForMenu}
					<li>
						<button
							type="button"
							class="play-menu-btn"
							onclick={() => {
								winMenuSheet = false;
								window.open(rulesUrlForMenu, '_blank', 'noopener,noreferrer');
							}}>Rules</button
						>
					</li>
				{/if}
				<li>
					<button
						type="button"
						class="play-menu-btn"
						onclick={() => {
							winMenuSheet = false;
							openRollerWindow();
						}}>Roller</button
					>
				</li>
				<li>
					<button
						type="button"
						class="play-menu-btn"
						onclick={() => {
							winMenuSheet = false;
							openLocalViewerFromSelection();
						}}>Viewer</button
					>
				</li>
				<li>
					<button
						type="button"
						class="play-menu-btn"
						onclick={() => {
							winMenuSheet = false;
							winSettings = true;
						}}>Settings</button
					>
				</li>
				<li>
					<button
						type="button"
						class="play-menu-btn"
						onclick={() => {
							winMenuSheet = false;
							winConn = true;
						}}>Connection</button
					>
				</li>
				{#if data.isHost}
					<li>
						<button
							type="button"
							class="play-menu-btn danger"
							onclick={() => {
								winMenuSheet = false;
								hostEndGame();
							}}>End game</button
						>
					</li>
				{/if}
			</ul>
		</BottomSheet>

		<BottomSheet title="Dice Roller" visible={winRoller} requestClose={() => (winRoller = false)}>
			<DiceRoller rollerName={data.profile?.display_name ?? 'Player'} />
		</BottomSheet>

		<BottomSheet title="Connection" visible={winConn} requestClose={() => (winConn = false)}>
			<Connection />
		</BottomSheet>

		<BottomSheet title="Settings" visible={winSettings} requestClose={() => (winSettings = false)}>
			<Settings />
		</BottomSheet>

		<BottomSheet
			title="Viewer (local)"
			visible={winViewer}
			requestClose={() => {
				winViewer = false;
				viewerPieceId = null;
				viewerLocked = false;
			}}
		>
			<CardViewer
					bind:targetPieceId={viewerPieceId}
					bind:viewerLocked
					selfDisplayName={data.profile?.display_name ?? 'You'}
				/>
		</BottomSheet>
	{:else}
		<WindowFrame title="Dice Roller" visible={winRoller} requestClose={() => (winRoller = false)}>
			<DiceRoller rollerName={data.profile?.display_name ?? 'Player'} />
		</WindowFrame>

		<WindowFrame title="Connection" visible={winConn} requestClose={() => (winConn = false)}>
			<Connection />
		</WindowFrame>

		<WindowFrame title="Settings" visible={winSettings} requestClose={() => (winSettings = false)}>
			<Settings />
		</WindowFrame>

		<WindowFrame
			title="Viewer (local)"
			visible={winViewer}
			requestClose={() => {
				winViewer = false;
				viewerPieceId = null;
				viewerLocked = false;
			}}
		>
			<CardViewer
					bind:targetPieceId={viewerPieceId}
					bind:viewerLocked
					selfDisplayName={data.profile?.display_name ?? 'You'}
				/>
		</WindowFrame>
	{/if}
</div>

<style>
	.play-topbar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 2000000001;
		display: flex;
		flex-direction: column;
		pointer-events: none;
	}
	.play-topbar :global(.toolbar-wrap) {
		pointer-events: auto;
	}
	.play-topbar :global(.history-inline) {
		pointer-events: auto;
	}
	.play-overlay-root {
		position: fixed;
		inset: 0;
		z-index: 2000000002;
		pointer-events: none;
	}
	.play-overlay-root :global(.window),
	.play-overlay-root :global(.bottom-sheet-root) {
		pointer-events: auto;
	}
	.play-menu {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.play-menu-btn {
		width: 100%;
		min-height: 48px;
		padding: 12px 16px;
		font-size: 16px;
		text-align: left;
		border: 1px solid var(--color-border-strong);
		border-radius: 8px;
		background: var(--color-btn-secondary-bg);
		color: var(--color-text);
		cursor: pointer;
	}
	.play-menu-btn.danger {
		color: var(--color-endgame);
		font-weight: 600;
	}
</style>
