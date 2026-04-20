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
	import PlayControlsHelp from '$lib/components/PlayControlsHelp.svelte';
	import PlayAssistBar from '$lib/components/PlayAssistBar.svelte';
	import PiecePeekOverlay from '$lib/components/PiecePeekOverlay.svelte';
	import DealToDialog from '$lib/components/DealToDialog.svelte';
	import { closeDealDialog, dealDialog } from '$lib/stores/dealDialog';
	import type { GameDataJson } from '$lib/engine/types';
	import { hasAttr, pieceSupportsFlip } from '$lib/engine/pieces';
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
	import { voiceChatState, leaveVoiceRoom, tryAutoJoinVoice } from '$lib/stores/voiceChat';
	import VoiceControls from '$lib/components/VoiceControls.svelte';
	import { endGame } from '$lib/lobby';
	import type { Json } from '$lib/supabase/database.types';
	import type { PageData } from './$types';
	import { browser } from '$app/environment';
	import { scheduleAppleTouchPieceImageWarmup } from '$lib/browser/iosPieceImageWarmup';
	import { appleStagingBarrier, isAppleTouchWebKit } from '$lib/browser/ios';
	import PlayLoadProfileHud from '$lib/debug/PlayLoadProfileHud.svelte';
	import { playLoadMark, playLoadProfileReset, playLoadProfileStart } from '$lib/debug/playLoadProfile';
	import { selfPresenceMeta } from '$lib/stores/onlinePresence';

	export let data: PageData;

	const supabase = createSupabaseBrowserClient();

	/** If Realtime never reaches SUBSCRIBED, `connectGameChannel` would hang forever and block Board mount. */
	const CONNECT_GAME_CHANNEL_TIMEOUT_MS = 15_000;

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
	let winControlsHelp = false;
	/** Hold physical <kbd>P</kbd> for a large preview of the top-most selected piece. */
	let peekPieceId: number | null = null;
	/** When set, {@link PiecePeekOverlay} shows this line instead of “Release P…”. */
	let peekDismissHint: string | null = null;
	let useMobileSheets = false;
	let removeMobileMq: (() => void) | undefined;
	let viewerPieceId: number | null = null;
	/** When true, board clicks do not change the viewer preview (locked to `viewerPieceId`). */
	let viewerLocked = false;

	let unsubAutosave: (() => void) | undefined;
	let historyRecordInterval: ReturnType<typeof setInterval> | undefined;
	let historyDeferTimer: number | null = null;
	/** Used to fit `initial_play_view` in the visible area below the fixed top bar (not under it). */
	let playTopbarMeasure = 0;
	/**
	 * iOS Safari changes chrome/layout during URL bar show/hide; raw `clientHeight` can jitter and
	 * would churn `initialPlayFitInset` + camera refits. Snap to reduce refit storms.
	 */
	$: playTopbarInset =
		playTopbarMeasure <= 0 ? 0 : Math.round(playTopbarMeasure / 4) * 4;

	$: rulesUrlForMenu = data.customGame
		? data.customGame.rulesUrl
		: `/data/${$game.curGame}/rules.pdf`;

	/** Local enlarged piece preview only — never broadcast (unlike Dice Roller). */
	function togglePiecePeekFromAssist(pieceId: number) {
		if (peekPieceId === pieceId) {
			peekPieceId = null;
			peekDismissHint = null;
		} else {
			peekPieceId = pieceId;
			peekDismissHint = 'Press Esc or tap Preview again to close';
		}
	}

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
		if (!get(isHistoryReplayActive) && peekPieceId !== null && e.key === 'Escape') {
			peekPieceId = null;
			peekDismissHint = null;
			e.preventDefault();
			return;
		}
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
			const st = get(game);
			const flipCapable = st.pieces.filter(
				(p) => st.selectedIds.has(p.id) && pieceSupportsFlip(p)
			);
			if (flipCapable.length > 0) g.flipSelectedPiecesSync();
		} else if (e.key === 's' || e.key === 'S') {
			if (isTypingInField(e.target)) return;
			const st = get(game);
			const sel = st.pieces.filter((p) => st.selectedIds.has(p.id));
			const arrangeUnlockedCount = [...st.selectedIds].filter((id) => {
				const p = st.pieces.find((x) => x.id === id);
				return p != null && !p.locked;
			}).length;
			if (
				sel.length > 1 &&
				sel.every((p) => hasAttr(p, 'move')) &&
				arrangeUnlockedCount >= 2
			) {
				e.preventDefault();
				g.runShuffleMovableSelection();
			}
		} else if (e.key === 'a' || e.key === 'A') {
			g.runArrangeSmart();
		} else if (e.code === 'KeyP') {
			if (isTypingInField(e.target)) return;
			if (e.repeat) return;
			e.preventDefault();
			const sel = get(game).selectedIds;
			if (sel.size === 0) return;
			const pieces = get(game).pieces.filter((p) => sel.has(p.id));
			const top = [...pieces].sort((a, b) => b.zIndex - a.zIndex || b.id - a.id)[0];
			peekDismissHint = null;
			peekPieceId = top.id;
			return;
		} else if (e.key === 'Backspace') {
			const sel = get(game).pieces.filter((p) => get(game).selectedIds.has(p.id));
			if (sel.every((p) => p.attributes.includes('destroy'))) sel.forEach((p) => g.destroyPiece(p.id));
		}
	}

	function onKeyUp(e: KeyboardEvent) {
		if (e.code === 'KeyP') {
			peekPieceId = null;
			peekDismissHint = null;
		}
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
		if (el?.closest?.('[data-bge-context-menu]')) return;
		if (el?.closest?.('[data-bge-deal-dialog]')) return;
		if (el?.closest?.('[data-play-assist-bar]')) return;
		ctxOpen = false;
	}

	onMount(() => {
		if (browser) {
			selfPresenceMeta.set({
				status: 'in_game',
				lobby_id: data.lobby.id,
				game_key: data.lobby.game_key
			});
		}
		const onWinBlur = () => {
			peekPieceId = null;
			peekDismissHint = null;
		};
		if (browser) {
			window.addEventListener('blur', onWinBlur);
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
			try {
				playLoadProfileStart();
				await appleStagingBarrier();

				registerFriendVoiceSaver(supabase);
				/** Load friend voice prefs after realtime + board (was ~500ms+ on mobile and blocked the game). */
				if (data.profile) {
					tryAutoJoinVoice(data.lobby.id, {
						userId: data.session.user.id,
						displayName: data.profile.display_name,
						avatarUrl: data.profile.avatar_url,
						subtitle: data.profile.username ? `@${data.profile.username}` : null
					});
				}
				if (data.profile) {
					try {
						await Promise.race([
							connectGameChannel(
								data.lobby.id,
								{
									userId: data.session.user.id,
									displayName: data.profile.display_name,
									avatarUrl: data.profile.avatar_url
								},
								{ memberOrderIds: memberOrderForPlay(data.lobby.id, data.memberOrderIds) }
							),
							new Promise<never>((_, rej) => {
								setTimeout(
									() =>
										rej(
											new Error(
												`game realtime subscribe timeout (${CONNECT_GAME_CHANNEL_TIMEOUT_MS}ms)`
											)
										),
									CONNECT_GAME_CHANNEL_TIMEOUT_MS
								);
							})
						]);
						playLoadMark('realtime');
						await appleStagingBarrier();
					} catch (e) {
						console.error('[bge] realtime', e);
					}
				}

				playLoadMark('pre_game_data');

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

				playLoadMark('game_loaded');

				scheduleAppleTouchPieceImageWarmup(get(game));

				/** Do not block play shell on Supabase — slow networks were stalling init on mobile. */
				void loadFriendVoicePrefsFromSupabase(supabase, data.session.user.id)
					.then(() => playLoadMark('voice_prefs'))
					.catch((err) => console.warn('[bge] loadFriendVoicePrefs', err));

				await appleStagingBarrier();

				unsubAutosave = g.subscribeGameSnapshotAutosave(() => {
					void persistSnapshot();
				});

				/** Catch up with live board after refresh — DB snapshot can lag Realtime; peers hold truth. */
				setTimeout(() => requestStateSyncFromPeers(), 400);
				setTimeout(() => requestStateSyncFromPeers(), 2000);

				function startHistoryRecording(): void {
					configureHistoryRecording({
						lobbyId: data.lobby.id,
						userId: data.session.user.id,
						supabase
					});
					initRecordingBaseline();
					historyRecordInterval = setInterval(() => {
						void tryRecordHistorySnapshot();
					}, HISTORY_RECORD_INTERVAL_MS);
					playLoadMark('history_started');
				}
				/** Defer on iOS — snapshot DB + board init already spikes memory; history adds timers + Supabase work. */
				if (isAppleTouchWebKit()) {
					historyDeferTimer = window.setTimeout(() => {
						historyDeferTimer = null;
						startHistoryRecording();
					}, 320) as unknown as number;
				} else {
					startHistoryRecording();
				}
			} catch (e) {
				console.error('[bge] play mount init failed', e);
			}
		})();

		return () => {
			selfPresenceMeta.set({});
			if (historyDeferTimer) {
				clearTimeout(historyDeferTimer);
				historyDeferTimer = null;
			}
			if (browser) window.removeEventListener('blur', onWinBlur);
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
		playLoadProfileReset();
		selfPresenceMeta.set({});
		closeDealDialog();
		disconnectGame();
	});
</script>

<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} oncontextmenu={onContextMenu} />

<div class="play-topbar" bind:clientHeight={playTopbarMeasure}>
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
		voiceSelfAvatarUrl={data.profile?.avatar_url ?? null}
		voiceBroadcastSubtitle={data.profile?.username ? `@${data.profile.username}` : null}
		onEndGame={data.isHost ? hostEndGame : null}
		onToggleHistory={onToolbarToggleHistory}
		historyReplayActive={$isHistoryReplayActive}
		onOpenMenu={() => (winMenuSheet = true)}
		onOpenControlsHelp={() => {
			if (useMobileSheets) winMenuSheet = false;
			winControlsHelp = true;
		}}
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
	initialPlayFitInset={playTopbarInset > 0 ? { top: playTopbarInset } : undefined}
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
							winControlsHelp = true;
						}}>Controls</button
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

		<BottomSheet title="Controls" visible={winControlsHelp} requestClose={() => (winControlsHelp = false)}>
			<PlayControlsHelp />
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

		<WindowFrame title="Controls" visible={winControlsHelp} requestClose={() => (winControlsHelp = false)}>
			<PlayControlsHelp />
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
	<PiecePeekOverlay
		pieceId={peekPieceId}
		dismissHint={peekDismissHint}
		selfDisplayName={data.profile?.display_name ?? 'You'}
	/>

	<PlayAssistBar
		scrollWheelPans={$settings.scrollWheelPans}
		replayMode={$isHistoryReplayActive}
		selfDisplayName={data.profile?.display_name ?? 'You'}
		onTogglePiecePeek={togglePiecePeekFromAssist}
	/>

	{#if $voiceChatState.joined}
		<div class="voice-dock-play">
			<VoiceControls
				lobbyId={data.lobby.id}
				selfUserId={data.session.user.id}
				displayName={data.profile?.display_name ?? 'You'}
				selfAvatarUrl={data.profile?.avatar_url}
				selfEmail={data.session.user.email}
				broadcastSubtitle={data.profile?.username ? `@${data.profile.username}` : null}
			/>
		</div>
	{/if}
</div>

<PlayLoadProfileHud />

{#if $dealDialog.open}
	<DealToDialog
		open={$dealDialog.open}
		roster={$dealDialog.roster}
		maxCards={$dealDialog.maxCards}
		reducedMotion={$dealDialog.reducedMotion}
		onConfirm={(cardCount, rosterIndices) => {
			void g.runDealCardsToRoster(rosterIndices, cardCount, {
				reducedMotion: $dealDialog.reducedMotion
			});
		}}
		onClose={closeDealDialog}
	/>
{/if}

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
		/* Notch / home indicator — keeps toolbar out from under system chrome on iPhone */
		padding-top: env(safe-area-inset-top, 0px);
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
	.play-overlay-root :global([data-bge-piece-peek]) {
		pointer-events: none;
	}
	.play-overlay-root :global([data-play-assist-bar]) {
		pointer-events: auto;
	}
	.voice-dock-play {
		position: fixed;
		left: max(12px, env(safe-area-inset-left, 0px));
		bottom: max(12px, env(safe-area-inset-bottom, 0px));
		z-index: 2000000003;
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
