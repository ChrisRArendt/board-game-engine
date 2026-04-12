<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
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
	import {
		emit,
		connectGameChannel,
		disconnectGame,
		getLocalPlayerColor
	} from '$lib/stores/network';
	import { isZoomMinusKey, isZoomPlusKey } from '$lib/engine/input';
	import { getViewportSize } from '$lib/engine/geometry';
	import type { PageData } from './$types';

	export let data: PageData;

	let ctxOpen = false;
	let ctxX = 0;
	let ctxY = 0;

	let winRoller = false;
	let winConn = false;
	let winSettings = false;
	let winViewer = false;
	let viewerPieceId: number | null = null;

	function focalCenter() {
		const vp = getViewportSize();
		return { left: vp.w / 2 + window.scrollX, top: vp.h / 2 + window.scrollY };
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
		registerGameEmit((type, data) => {
			if (type === 'piece_select') {
				emit(type, { ...data, color: getLocalPlayerColor() });
			} else {
				emit(type, data);
			}
		});

		if (data.profile) {
			void connectGameChannel(data.lobby.id, {
				userId: data.session.user.id,
				displayName: data.profile.display_name
			}).catch((e) => console.error('[bge] realtime', e));
		}

		fetch(`/data/${data.lobby.game_key}/pieces.json`)
			.then((r) => r.json())
			.then((j: GameDataJson) => {
				g.loadGameData(j);
				g.centerCamToVP();
			});

		if (browser) {
			(window as unknown as { __bgeViewerSet?: (id: number) => void }).__bgeViewerSet = (id: number) => {
				viewerPieceId = id;
			};
			(window as unknown as { __bgeViewerClear?: () => void }).__bgeViewerClear = () => {
				viewerPieceId = null;
			};

			window.addEventListener('bge:roller_roll', ((ev: CustomEvent) => {
				const d = ev.detail as { rollId: string; result: string | number; datestr: string };
				(window as unknown as { __bgeLastRoll?: typeof d }).__bgeLastRoll = d;
			}) as EventListener);

			window.addEventListener('bge:window_open', ((ev: CustomEvent) => {
				const w = ev.detail?.winid as string;
				if (w === 'window_roller') winRoller = true;
			}) as EventListener);
		}

		window.addEventListener('click', onDocClick);
		return () => window.removeEventListener('click', onDocClick);
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
	viewer={() => {
		winViewer = true;
	}}
	openSettings={() => (winSettings = true)}
	openConnection={() => (winConn = true)}
/>

<Board zoomWithScroll={$settings.zoomWithScroll} panScreenEdge={$settings.panScreenEdge} />

<UserList />

<ContextMenu bind:open={ctxOpen} x={ctxX} y={ctxY} />

<WindowFrame title="Dice Roller" open={winRoller} onclose={() => (winRoller = false)}>
	<DiceRoller />
</WindowFrame>

<WindowFrame title="Connection" open={winConn} onclose={() => (winConn = false)}>
	<Connection />
</WindowFrame>

<WindowFrame title="Settings" open={winSettings} onclose={() => (winSettings = false)}>
	<Settings />
</WindowFrame>

<WindowFrame title="Viewer" open={winViewer} onclose={() => (winViewer = false)}>
	<CardViewer bind:targetPieceId={viewerPieceId} />
</WindowFrame>
