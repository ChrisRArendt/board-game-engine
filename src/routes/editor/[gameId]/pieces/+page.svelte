<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { createSupabaseBrowserClient } from '$lib/supabase/client';
	import { publicStorageUrl } from '$lib/editor/mediaUrls';
	import {
		rasterizeCardFrontAndBack,
		rasterizeCardInstanceToBlob,
		templateRowHasBack,
		type TemplateRow
	} from '$lib/editor/bulkCardRasterize';
	import { zipPngFiles, downloadBlob } from '$lib/editor/printExport';
	import { generateDuplexPrintPdf, downloadPdf } from '$lib/editor/pdfExport';
	import {
		layoutCardsToSheetPages,
		layoutDuplexCardSheets,
		rasterBlobDimensions,
		type DuplexCardForSheet,
		type PageSizeId
	} from '$lib/editor/printSheet';
	import PieceGridTile, { type RenderPhase } from '$lib/components/editor/PieceGridTile.svelte';
	import type { PageData } from './$types';
	import type { Json } from '$lib/supabase/database.types';
	import { parseGameDataJson, removeBoardPiecesForCard } from '$lib/editor/gameDataJson';
	import { browser } from '$app/environment';

	let { data }: { data: PageData } = $props();

	type SortBy = 'template' | 'name' | 'updated';

	let sortBy = $state<SortBy>('template');

	const SORT_MENU_W = 280;
	const SORT_MENU_H = 140;

	let sortMenuOpen = $state(false);
	let sortMenuLeft = $state(0);
	let sortMenuTop = $state(0);

	function clipSortMenuPos(cx: number, cy: number) {
		if (!browser) return { left: cx, top: cy };
		const pad = 8;
		const maxL = Math.max(pad, window.innerWidth - SORT_MENU_W - pad);
		const maxT = Math.max(pad, window.innerHeight - SORT_MENU_H - pad);
		return {
			left: Math.min(Math.max(pad, cx), maxL),
			top: Math.min(Math.max(pad, cy), maxT)
		};
	}

	function onSortControlContextMenu(e: MouseEvent) {
		e.preventDefault();
		const c = clipSortMenuPos(e.clientX, e.clientY);
		sortMenuLeft = c.left;
		sortMenuTop = c.top;
		sortMenuOpen = true;
	}

	function closeSortMenu() {
		sortMenuOpen = false;
	}

	function pickSortBy(mode: SortBy) {
		sortBy = mode;
		closeSortMenu();
	}

	function onGlobalPointerForSortMenu(e: PointerEvent) {
		if (!sortMenuOpen) return;
		if ((e.target as HTMLElement | null)?.closest?.('[data-pieces-sort-ctx]')) return;
		closeSortMenu();
	}

	function onGlobalKeySortMenu(e: KeyboardEvent) {
		if (e.key === 'Escape') closeSortMenu();
	}

	const supabase = createSupabaseBrowserClient();

	let busy = $state(false);
	let err = $state('');
	let sheetPageSize = $state<PageSizeId>('letter');
	let filterTemplateId = $state<string | 'all'>('all');
	let newFromTemplateId = $state('');

	let printPdfOpen = $state(false);
	let printPdfBusy = $state(false);
	let printPdfPageSize = $state<PageSizeId>('letter');
	let printPdfSelected = $state<Record<string, boolean>>({});
	let printPdfQty = $state<Record<string, number>>({});

	/** Multi-select (visual order on page — used for Shift+click range). */
	let selectedIds = $state<Set<string>>(new Set());
	let selectionAnchorId = $state<string | null>(null);
	let tileRenderPhase: Record<string, RenderPhase> = $state({});
	let bulkRerenderProgress = $state<{ cur: number; total: number } | null>(null);

	const mediaUrls = $derived(
		Object.fromEntries((data.mediaForCards ?? []).map((m) => [m.id, publicStorageUrl(m.file_path)]))
	);

	const staleCards = $derived(data.cards.filter((c) => c.render_stale));

	const filteredCards = $derived(
		filterTemplateId === 'all'
			? data.cards
			: data.cards.filter((c) => c.template_id === filterTemplateId)
	);

	const sortedCards = $derived.by(() => {
		const list = [...filteredCards];
		const tmplName = (tid: string) =>
			data.templates.find((t) => t.id === tid)?.name ?? '';
		if (sortBy === 'name') {
			list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
		} else if (sortBy === 'updated') {
			list.sort(
				(a, b) =>
					new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
			);
		} else {
			list.sort((a, b) => {
				const c = tmplName(a.template_id).localeCompare(tmplName(b.template_id), undefined, {
					sensitivity: 'base'
				});
				if (c !== 0) return c;
				return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
			});
		}
		return list;
	});

	const cardsByTemplate = $derived.by(() => {
		if (sortBy !== 'template') return null;
		const map = new Map<string, typeof data.cards>();
		for (const c of sortedCards) {
			const arr = map.get(c.template_id) ?? [];
			arr.push(c);
			map.set(c.template_id, arr);
		}
		return map;
	});

	const templatesForSections = $derived(
		filterTemplateId === 'all'
			? data.templates
			: data.templates.filter((t) => t.id === filterTemplateId)
	);

	/** Same order as tiles appear (template sections top-to-bottom, then cards per template). */
	const piecesInDisplayOrder = $derived.by(() => {
		if (sortBy === 'template') {
			const out: PageData['cards'] = [];
			for (const t of templatesForSections) {
				for (const c of cardsByTemplate?.get(t.id) ?? []) out.push(c);
			}
			return out;
		}
		return sortedCards;
	});

	const selectedCount = $derived(selectedIds.size);

	function thumb(path: string | null) {
		if (!path) return '';
		return publicStorageUrl(path);
	}

	function handleTileSelect(cardId: string, e: MouseEvent) {
		const order = piecesInDisplayOrder.map((c) => c.id);
		const idx = order.indexOf(cardId);
		if (idx < 0) return;

		if (e.shiftKey && selectionAnchorId != null) {
			const a = order.indexOf(selectionAnchorId);
			if (a < 0) {
				const next = new Set(selectedIds);
				if (next.has(cardId)) next.delete(cardId);
				else next.add(cardId);
				selectedIds = next;
			} else {
				const lo = Math.min(a, idx);
				const hi = Math.max(a, idx);
				const next = new Set<string>();
				for (let i = lo; i <= hi; i++) next.add(order[i]);
				selectedIds = next;
			}
		} else {
			const next = new Set(selectedIds);
			if (next.has(cardId)) next.delete(cardId);
			else next.add(cardId);
			selectedIds = next;
		}
		selectionAnchorId = cardId;
	}

	function selectAllVisible() {
		selectedIds = new Set(sortedCards.map((c) => c.id));
		if (sortedCards.length) selectionAnchorId = sortedCards[sortedCards.length - 1].id;
	}

	function clearPieceSelection() {
		selectedIds = new Set();
		selectionAnchorId = null;
	}

	$effect(() => {
		const valid = new Set(sortedCards.map((c) => c.id));
		const pruned = new Set([...selectedIds].filter((id) => valid.has(id)));
		if (pruned.size !== selectedIds.size) {
			selectedIds = pruned;
		}
	});

	function templateRowFromDb(tmpl: PageData['templates'][number]): TemplateRow {
		return {
			canvas_width: tmpl.canvas_width,
			canvas_height: tmpl.canvas_height,
			border_radius: tmpl.border_radius,
			frame_border_width: tmpl.frame_border_width,
			frame_border_color: tmpl.frame_border_color,
			frame_inner_radius: tmpl.frame_inner_radius ?? null,
			background: tmpl.background,
			layers: tmpl.layers,
			back_background: tmpl.back_background,
			back_layers: tmpl.back_layers
		};
	}

	function openPrintPdfDialog() {
		const sel: Record<string, boolean> = {};
		const qty: Record<string, number> = {};
		for (const c of sortedCards) {
			sel[c.id] = true;
			qty[c.id] = 1;
		}
		printPdfSelected = sel;
		printPdfQty = qty;
		printPdfPageSize = sheetPageSize;
		printPdfOpen = true;
	}

	function togglePrintPdfSelectAll(on: boolean) {
		const next = { ...printPdfSelected };
		for (const c of sortedCards) {
			next[c.id] = on;
		}
		printPdfSelected = next;
	}

	async function generatePrintPdf() {
		if (printPdfBusy) return;
		const uid = data.session?.user?.id;
		if (!uid) {
			err = 'You must be signed in.';
			return;
		}
		printPdfBusy = true;
		err = '';
		try {
			const duplex: DuplexCardForSheet[] = [];
			for (const c of data.cards) {
				if (!printPdfSelected[c.id]) continue;
				const q = Math.max(1, Math.floor(printPdfQty[c.id] ?? 1));
				const tmpl = data.templates.find((t) => t.id === c.template_id);
				if (!tmpl) continue;
				const row = templateRowFromDb(tmpl);
				const hasBack = templateRowHasBack(row);
				const front = await rasterizeCardInstanceToBlob(row, c.field_values, mediaUrls, {
					scale: 2,
					face: 'front'
				});
				const back = hasBack
					? await rasterizeCardInstanceToBlob(row, c.field_values, mediaUrls, {
							scale: 2,
							face: 'back'
						})
					: null;
				const dim = await rasterBlobDimensions(front);
				for (let i = 0; i < q; i++) {
					duplex.push({
						frontBlob: front,
						backBlob: back,
						widthPx: dim.w,
						heightPx: dim.h
					});
				}
			}
			if (!duplex.length) {
				err = 'Select at least one piece with quantity ≥ 1.';
				return;
			}
			const bytes = await generateDuplexPrintPdf(duplex, printPdfPageSize);
			const safe =
				(String(data.game.title || 'game').replace(/[^\w\-.]+/g, '_') || 'print') + '-duplex.pdf';
			downloadPdf(bytes, safe);
			printPdfOpen = false;
		} catch (e) {
			err = e instanceof Error ? e.message : 'PDF export failed';
		} finally {
			printPdfBusy = false;
		}
	}

	async function rerenderOneCard(c: PageData['cards'][number], uid: string) {
		const tmpl = data.templates.find((t) => t.id === c.template_id);
		if (!tmpl) throw new Error('Piece type not found');
		const row = templateRowFromDb(tmpl);
		const { front, back } = await rasterizeCardFrontAndBack(row, c.field_values, mediaUrls, {
			scale: 2
		});
		const base = `${uid}/${data.game.id}/cards/${c.id}`;
		const frontPath = `${base}.png`;
		const { error: upErr } = await supabase.storage.from('custom-game-assets').upload(frontPath, front, {
			upsert: true,
			contentType: 'image/png'
		});
		if (upErr) throw upErr;
		if (back) {
			const backPath = `${base}-back.png`;
			const { error: upErr2 } = await supabase.storage.from('custom-game-assets').upload(backPath, back, {
				upsert: true,
				contentType: 'image/png'
			});
			if (upErr2) throw upErr2;
		}
		const { error: uErr } = await supabase
			.from('card_instances')
			.update({
				rendered_image_path: frontPath,
				render_stale: false,
				updated_at: new Date().toISOString()
			})
			.eq('id', c.id);
		if (uErr) throw uErr;
	}

	async function rerenderAllStale() {
		const uid = data.session?.user?.id;
		if (!uid) return;
		if (!staleCards.length) return;
		if (!confirm(`Re-render ${staleCards.length} stale piece(s)? This may take a minute.`)) return;
		busy = true;
		err = '';
		try {
			let i = 0;
			for (const c of staleCards) {
				i += 1;
				bulkRerenderProgress = { cur: i, total: staleCards.length };
				tileRenderPhase = { ...tileRenderPhase, [c.id]: 'running' };
				try {
					await rerenderOneCard(c, uid);
					tileRenderPhase = { ...tileRenderPhase, [c.id]: 'done' };
				} catch {
					tileRenderPhase = { ...tileRenderPhase, [c.id]: 'error' };
				}
			}
			await invalidateAll();
			bulkRerenderProgress = null;
			window.setTimeout(() => {
				tileRenderPhase = {};
			}, 2000);
		} catch (e) {
			err = e instanceof Error ? e.message : 'Bulk render failed';
			bulkRerenderProgress = null;
		}
		busy = false;
	}

	async function rerenderSelectedCards() {
		const uid = data.session?.user?.id;
		if (!uid) {
			err = 'You must be signed in to render.';
			return;
		}
		const ids = [...selectedIds];
		if (!ids.length) return;
		if (
			!confirm(`Re-render ${ids.length} selected piece(s)? This may take a minute.`)
		) {
			return;
		}
		busy = true;
		err = '';
		const total = ids.length;
		try {
			for (let i = 0; i < ids.length; i++) {
				const id = ids[i];
				bulkRerenderProgress = { cur: i + 1, total };
				tileRenderPhase = { ...tileRenderPhase, [id]: 'running' };
				const c = data.cards.find((x) => x.id === id);
				if (!c) {
					tileRenderPhase = { ...tileRenderPhase, [id]: 'error' };
					continue;
				}
				try {
					await rerenderOneCard(c, uid);
					tileRenderPhase = { ...tileRenderPhase, [id]: 'done' };
				} catch {
					tileRenderPhase = { ...tileRenderPhase, [id]: 'error' };
				}
			}
			await invalidateAll();
			window.setTimeout(() => {
				const next = { ...tileRenderPhase };
				for (const id of ids) delete next[id];
				tileRenderPhase = next;
				bulkRerenderProgress = null;
			}, 2200);
		} catch (e) {
			err = e instanceof Error ? e.message : 'Render failed';
			bulkRerenderProgress = null;
		}
		busy = false;
	}

	async function deleteSelectedPieces() {
		if (!data.session?.user) {
			err = 'You must be signed in to delete pieces.';
			return;
		}
		const ids = [...selectedIds];
		if (!ids.length) return;
		if (
			!confirm(
				`Delete ${ids.length} selected piece(s) from the game? Any copies on the board will be removed. This cannot be undone.`
			)
		) {
			return;
		}
		busy = true;
		err = '';
		try {
			let gd = parseGameDataJson(data.game.game_data);
			for (const id of ids) gd = removeBoardPiecesForCard(gd, id);
			const { error: gErr } = await supabase
				.from('custom_board_games')
				.update({
					game_data: gd as unknown as Json,
					updated_at: new Date().toISOString()
				})
				.eq('id', data.game.id);
			if (gErr) throw gErr;

			for (const id of ids) {
				const c = data.cards.find((x) => x.id === id);
				const path = c?.rendered_image_path;
				if (path) {
					const { error: rmErr } = await supabase.storage.from('custom-game-assets').remove([path]);
					if (rmErr) console.warn('[delete pieces] storage remove', rmErr);
				}
				const { error: dErr } = await supabase
					.from('card_instances')
					.delete()
					.eq('id', id)
					.eq('game_id', data.game.id);
				if (dErr) throw dErr;
			}

			selectedIds = new Set();
			selectionAnchorId = null;
			await invalidateAll();
		} catch (e) {
			err = e instanceof Error ? e.message : 'Delete failed';
		}
		busy = false;
	}

	async function exportTemplateZip(templateId: string) {
		const tmpl = data.templates.find((t) => t.id === templateId);
		if (!tmpl) return;
		const cardsForT = data.cards.filter((c) => c.template_id === templateId);
		if (!cardsForT.length) {
			alert('No pieces of this type.');
			return;
		}
		busy = true;
		err = '';
		try {
			const files: { path: string; blob: Blob }[] = [];
			const row = templateRowFromDb(tmpl);
			const duplexSheets = templateRowHasBack(row);
			const sheetInput: { blob: Blob; widthPx: number; heightPx: number }[] = [];
			const sheetDuplex: DuplexCardForSheet[] = [];
			for (const c of cardsForT) {
				const front = await rasterizeCardInstanceToBlob(row, c.field_values, mediaUrls, {
					scale: 2,
					face: 'front'
				});
				const safe =
					((c.name || `card-${c.id}`).replace(/[^\w\-.]+/g, '_') || 'card').slice(0, 80) + '.png';
				files.push({ path: `cards/${safe}`, blob: front });
				const dim = await rasterBlobDimensions(front);
				if (duplexSheets) {
					const back = await rasterizeCardInstanceToBlob(row, c.field_values, mediaUrls, {
						scale: 2,
						face: 'back'
					});
					sheetDuplex.push({
						frontBlob: front,
						backBlob: back,
						widthPx: dim.w,
						heightPx: dim.h
					});
				} else {
					sheetInput.push({ blob: front, widthPx: dim.w, heightPx: dim.h });
				}
			}
			if (duplexSheets) {
				const pairs = await layoutDuplexCardSheets(sheetDuplex, sheetPageSize);
				pairs.forEach((p, i) => {
					const n = String(i + 1).padStart(2, '0');
					files.push({ path: `sheets/page-${n}-front.png`, blob: p.front });
					files.push({ path: `sheets/page-${n}-back.png`, blob: p.back });
				});
			} else {
				const sheetBlobs = await layoutCardsToSheetPages(sheetInput, sheetPageSize);
				sheetBlobs.forEach((b, i) => {
					files.push({
						path: `sheets/page-${String(i + 1).padStart(2, '0')}.png`,
						blob: b
					});
				});
			}
			const zipBlob = await zipPngFiles(files);
			downloadBlob(
				zipBlob,
				`${(tmpl.name || 'cards').replace(/\s+/g, '-')}-print-300dpi.zip`
			);
		} catch (e) {
			err = e instanceof Error ? e.message : 'ZIP export failed';
		}
		busy = false;
	}

	async function createCard(templateId: string) {
		busy = true;
		try {
			const { data: row, error } = await supabase
				.from('card_instances')
				.insert({
					game_id: data.game.id,
					template_id: templateId,
					name: 'New piece',
					field_values: {},
					render_stale: true
				})
				.select('id')
				.single();
			if (error) throw error;
			await goto(`/editor/${data.game.id}/pieces/${row.id}`);
		} catch (e) {
			console.error(e);
		}
		busy = false;
	}

</script>

<div class="page editor-page-scroll">
	<h1>Pieces</h1>

	<div class="list-controls">
		<label>
			Type
			<select bind:value={filterTemplateId}>
				<option value="all">All types</option>
				{#each data.templates as t (t.id)}
					<option value={t.id}>{t.name}</option>
				{/each}
			</select>
		</label>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<label
			class="sort-control"
			title="Sort the list. Right-click for the same options in a menu."
			oncontextmenu={onSortControlContextMenu}
		>
			Sort
			<select bind:value={sortBy}>
				<option value="template">By type (A–Z), then name</option>
				<option value="name">Name (A–Z)</option>
				<option value="updated">Recently updated</option>
			</select>
		</label>
	</div>

	{#if sortMenuOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
		<ul
			class="pieces-sort-ctx"
			data-pieces-sort-ctx
			role="menu"
			aria-label="Sort list"
			style:left="{sortMenuLeft}px"
			style:top="{sortMenuTop}px"
			onpointerdown={(e) => e.stopPropagation()}
		>
			<li role="none">
				<button
					type="button"
					class="sort-menu-item"
					role="menuitemradio"
					aria-checked={sortBy === 'template'}
					class:current={sortBy === 'template'}
					onpointerdown={(e) => {
						e.stopPropagation();
						pickSortBy('template');
					}}
				>
					Sort by type (A–Z), then name
				</button>
			</li>
			<li role="none">
				<button
					type="button"
					class="sort-menu-item"
					role="menuitemradio"
					aria-checked={sortBy === 'name'}
					class:current={sortBy === 'name'}
					onpointerdown={(e) => {
						e.stopPropagation();
						pickSortBy('name');
					}}
				>
					Sort by name (A–Z)
				</button>
			</li>
			<li role="none">
				<button
					type="button"
					class="sort-menu-item"
					role="menuitemradio"
					aria-checked={sortBy === 'updated'}
					class:current={sortBy === 'updated'}
					onpointerdown={(e) => {
						e.stopPropagation();
						pickSortBy('updated');
					}}
				>
					Sort by recently updated
				</button>
			</li>
		</ul>
	{/if}

	<div class="selection-toolbar">
		<button type="button" class="btn" disabled={!sortedCards.length} onclick={selectAllVisible}>
			Select all
		</button>
		<button type="button" class="btn" disabled={selectedCount === 0} onclick={clearPieceSelection}>
			Clear selection
		</button>
		<span class="sel-count">{selectedCount} selected</span>
		<button
			type="button"
			class="btn primary"
			disabled={busy || selectedCount === 0 || !data.session?.user}
			onclick={() => void rerenderSelectedCards()}
		>
			{bulkRerenderProgress && busy ? `Rendering ${bulkRerenderProgress.cur}/${bulkRerenderProgress.total}…` : 'Re-render selected'}
		</button>
		<button
			type="button"
			class="btn danger"
			disabled={busy || selectedCount === 0 || !data.session?.user}
			onclick={() => void deleteSelectedPieces()}
		>
			Delete selected
		</button>
		{#if bulkRerenderProgress && busy}
			<span class="bulk-hint" aria-live="polite">
				{bulkRerenderProgress.cur} of {bulkRerenderProgress.total}
			</span>
		{/if}
	</div>

	<label class="sheet-opt">
		Print sheet page size (ZIP)
		<select bind:value={sheetPageSize}>
			<option value="letter">US Letter (8.5×11")</option>
			<option value="a4">A4</option>
		</select>
	</label>

	<div class="print-pdf-actions">
		<button
			type="button"
			class="btn primary"
			disabled={busy || !data.cards.length}
			onclick={openPrintPdfDialog}
		>
			Print PDF (duplex)
		</button>
	</div>

	{#if printPdfOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="modal-backdrop"
			onclick={() => (printPdfOpen = false)}
			role="presentation"
		>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				class="modal print-pdf-dialog"
				onclick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-labelledby="print-pdf-title"
				tabindex="-1"
			>
				<h2 id="print-pdf-title">Print-ready PDF</h2>
				<p class="print-pdf-hint">
					Duplex: print all pages with <strong>flip on long edge</strong>. Or print odd pages first,
					flip the stack, then even pages. Pages are interleaved: sheet 1 fronts, sheet 1 backs, …
				</p>
				<label class="modal-field">
					Page size
					<select bind:value={printPdfPageSize} disabled={printPdfBusy}>
						<option value="letter">US Letter (8.5×11")</option>
						<option value="a4">A4</option>
					</select>
				</label>
				<div class="select-all-row">
					<label>
						<input
							type="checkbox"
							checked={sortedCards.length > 0 &&
								sortedCards.every((c) => printPdfSelected[c.id])}
							onchange={(e) =>
								togglePrintPdfSelectAll((e.currentTarget as HTMLInputElement).checked)}
							disabled={printPdfBusy || !sortedCards.length}
						/>
						Select all (current list)
					</label>
				</div>
				<div class="print-pdf-table-wrap">
					<table class="print-pdf-table">
						<thead>
							<tr>
								<th class="col-check"></th>
								<th>Name</th>
								<th>Type</th>
								<th class="col-qty">Qty</th>
							</tr>
						</thead>
						<tbody>
							{#each sortedCards as c (c.id)}
								{@const tmpl = data.templates.find((t) => t.id === c.template_id)}
								<tr>
									<td>
										<input
											type="checkbox"
											checked={printPdfSelected[c.id] ?? false}
											disabled={printPdfBusy}
											onchange={(e) => {
												printPdfSelected = {
													...printPdfSelected,
													[c.id]: (e.currentTarget as HTMLInputElement).checked
												};
											}}
										/>
									</td>
									<td>{c.name}</td>
									<td class="tm">{tmpl?.name ?? '—'}</td>
									<td>
										<input
											class="qty-input"
											type="number"
											min="1"
											max="999"
											value={printPdfQty[c.id] ?? 1}
											disabled={printPdfBusy}
											oninput={(e) => {
												const raw = (e.currentTarget as HTMLInputElement).value;
												const n = parseInt(raw, 10);
												printPdfQty = {
													...printPdfQty,
													[c.id]: Number.isFinite(n) && n >= 1 ? n : 1
												};
											}}
										/>
									</td>
								</tr>
							{:else}
								<tr>
									<td colspan="4" class="muted">No pieces match the current filter.</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<div class="modal-actions">
					<button
						type="button"
						class="btn"
						disabled={printPdfBusy}
						onclick={() => (printPdfOpen = false)}
					>
						Cancel
					</button>
					<button
						type="button"
						class="btn primary"
						disabled={printPdfBusy}
						onclick={() => void generatePrintPdf()}
					>
						{printPdfBusy ? 'Rasterizing…' : 'Download PDF'}
					</button>
				</div>
			</div>
		</div>
	{/if}

	{#if err}
		<p class="err">{err}</p>
	{/if}

	{#if staleCards.length}
		<div class="stale-banner">
			<span>{staleCards.length} piece(s) need re-render after a piece type was edited.</span>
			<button type="button" class="btn primary" disabled={busy} onclick={() => void rerenderAllStale()}>
				{busy ? 'Working…' : `Re-render all stale (${staleCards.length})`}
			</button>
		</div>
	{/if}

	{#if sortBy === 'template'}
		{#each templatesForSections as t (t.id)}
			<section class="sec">
				<h2>{t.name}</h2>
				<div class="row-btns">
					<button type="button" class="btn" disabled={busy} onclick={() => createCard(t.id)}>
						New piece of this type
					</button>
					<button
						type="button"
						class="btn"
						disabled={busy}
						onclick={() => void exportTemplateZip(t.id)}
					>
						Export ZIP (300 DPI)
					</button>
				</div>
				<div class="pieces-grid">
					{#each cardsByTemplate?.get(t.id) ?? [] as card (card.id)}
						<PieceGridTile
							gameId={data.game.id}
							{card}
							sublinkTemplateId={t.id}
							selected={selectedIds.has(card.id)}
							renderPhase={tileRenderPhase[card.id] ?? 'idle'}
							thumbUrl={thumb(card.rendered_image_path)}
							onToggleSelect={(e) => handleTileSelect(card.id, e)}
						/>
					{:else}
						<p class="muted pieces-grid-empty">No pieces of this type yet.</p>
					{/each}
				</div>
			</section>
		{:else}
			<p class="muted">Create a piece type first (Templates in the editor).</p>
		{/each}
	{:else}
		<section class="sec flat-sec">
			<div class="row-btns inline-create">
				<label>
					New piece
					<select bind:value={newFromTemplateId}>
						<option value="">— choose —</option>
						{#each data.templates as t (t.id)}
							<option value={t.id}>{t.name}</option>
						{/each}
					</select>
				</label>
				<button
					type="button"
					class="btn primary"
					disabled={busy || !newFromTemplateId}
					onclick={() => {
						if (newFromTemplateId) void createCard(newFromTemplateId);
					}}
				>
					Create
				</button>
			</div>
			<div class="pieces-grid">
				{#each sortedCards as card (card.id)}
					{@const tmpl = data.templates.find((x) => x.id === card.template_id)}
					<PieceGridTile
						gameId={data.game.id}
						{card}
						sublinkTemplateId={tmpl?.id ?? card.template_id}
						showTemplateLabel
						templateLabel={tmpl?.name ?? '—'}
						selected={selectedIds.has(card.id)}
						renderPhase={tileRenderPhase[card.id] ?? 'idle'}
						thumbUrl={thumb(card.rendered_image_path)}
						onToggleSelect={(e) => handleTileSelect(card.id, e)}
					/>
				{:else}
					<p class="muted pieces-grid-empty">No pieces match this filter.</p>
				{/each}
			</div>
		</section>
	{/if}

</div>

<svelte:window onpointerdown={onGlobalPointerForSortMenu} onkeydown={onGlobalKeySortMenu} />

<style>
	.page {
		padding: 1.25rem clamp(1rem, 3vw, 2rem);
		max-width: none;
		width: 100%;
		box-sizing: border-box;
		color: var(--color-text);
	}
	h1 {
		margin-top: 0;
	}
	.list-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 16px 24px;
		align-items: flex-end;
		margin-bottom: 1.25rem;
		font-size: 14px;
		color: var(--color-text-muted);
	}
	.list-controls label {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.list-controls select {
		padding: 6px 10px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		min-width: 200px;
	}
	.pieces-sort-ctx {
		display: block;
		position: fixed;
		list-style: none;
		margin: 0;
		padding: 2px 0;
		min-width: min(280px, calc(100vw - 16px));
		max-width: calc(100vw - 16px);
		z-index: 8000;
		background: var(--color-context-bg, var(--color-surface));
		border: 1px solid var(--color-border-strong);
		border-radius: 3px;
		box-shadow: var(--shadow-md);
		font-size: 16px;
		line-height: 1.25;
	}
	.pieces-sort-ctx .sort-menu-item {
		display: block;
		width: 100%;
		box-sizing: border-box;
		padding: 8px 12px;
		margin: 0;
		border: none;
		background: transparent;
		font: inherit;
		line-height: inherit;
		text-align: left;
		cursor: pointer;
		color: var(--color-text);
	}
	.pieces-sort-ctx .sort-menu-item:hover {
		background: var(--color-ctx-hover-bg, rgba(100, 120, 200, 0.25));
		color: #fff;
	}
	.pieces-sort-ctx .sort-menu-item.current {
		font-weight: 600;
	}
	.pieces-sort-ctx .sort-menu-item.current::before {
		content: '✓ ';
	}
	.inline-create label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
		color: var(--color-text-muted);
	}
	.inline-create select {
		padding: 6px 10px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		min-width: 220px;
	}
	.selection-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 16px;
		margin-bottom: 1rem;
		padding: 10px 12px;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-surface-muted, rgba(255, 255, 255, 0.03));
	}
	.selection-toolbar .btn {
		margin-bottom: 0;
	}
	.sel-count,
	.bulk-hint {
		font-size: 13px;
		color: var(--color-text-muted);
	}
	.pieces-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
		gap: clamp(10px, 1.5vw, 16px);
		width: 100%;
	}
	.pieces-grid-empty {
		grid-column: 1 / -1;
		margin: 0;
		padding: 8px 0;
	}
	.sec {
		margin-bottom: 2rem;
		border-bottom: 1px solid var(--color-border);
		padding-bottom: 1.25rem;
	}
	.sec h2 {
		font-size: 1.05rem;
		margin: 0 0 10px;
		font-weight: 600;
	}
	.btn {
		padding: 6px 12px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
		cursor: pointer;
		margin-bottom: 8px;
	}
	.muted {
		opacity: 0.7;
	}
	.err {
		color: #f87171;
		margin-bottom: 1rem;
	}
	.stale-banner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border-radius: 8px;
		background: rgba(251, 191, 36, 0.12);
		border: 1px solid rgba(251, 191, 36, 0.4);
		margin-bottom: 1.25rem;
		font-size: 14px;
	}
	.btn.primary {
		background: var(--color-accent, #3b82f6);
		color: #fff;
		border-color: transparent;
	}
	.btn.danger {
		border-color: rgba(248, 113, 113, 0.55);
		color: #f87171;
		background: rgba(248, 113, 113, 0.08);
	}
	.btn.danger:hover:not(:disabled) {
		background: rgba(248, 113, 113, 0.16);
	}
	.row-btns {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 14px;
	}
	.flat-sec .pieces-grid {
		margin-top: 4px;
	}
	.sheet-opt {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		font-size: 14px;
		margin-bottom: 1rem;
		color: var(--color-text-muted);
	}
	.sheet-opt select {
		padding: 6px 10px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: inherit;
	}
	.print-pdf-actions {
		margin-bottom: 1rem;
	}
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}
	.modal {
		background: var(--color-surface);
		color: var(--color-text);
		border-radius: 10px;
		border: 1px solid var(--color-border);
		padding: 1.25rem 1.5rem;
		max-width: 560px;
		width: 100%;
		max-height: min(90vh, 720px);
		overflow: auto;
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
	}
	.print-pdf-dialog h2 {
		margin: 0 0 0.5rem;
		font-size: 1.1rem;
	}
	.print-pdf-hint {
		font-size: 13px;
		color: var(--color-text-muted);
		margin: 0 0 1rem;
		line-height: 1.45;
	}
	.modal-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
		margin-bottom: 8px;
	}
	.modal-field select {
		padding: 6px 10px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: inherit;
		max-width: 260px;
	}
	.select-all-row {
		margin-bottom: 10px;
		font-size: 14px;
	}
	.print-pdf-table-wrap {
		overflow-x: auto;
		margin-bottom: 1rem;
		border: 1px solid var(--color-border);
		border-radius: 8px;
	}
	.print-pdf-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}
	.print-pdf-table th,
	.print-pdf-table td {
		padding: 8px 10px;
		text-align: left;
		border-bottom: 1px solid var(--color-border);
	}
	.print-pdf-table th {
		background: var(--color-bg);
		font-weight: 600;
	}
	.col-check {
		width: 36px;
	}
	.col-qty {
		width: 72px;
	}
	.qty-input {
		width: 4rem;
		padding: 4px 6px;
		border-radius: 4px;
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: inherit;
	}
	.print-pdf-table .tm {
		color: var(--color-text-muted);
		font-size: 12px;
	}
	.modal-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 8px;
	}
</style>
