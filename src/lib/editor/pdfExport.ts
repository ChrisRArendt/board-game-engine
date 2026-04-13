import { PDFDocument } from 'pdf-lib';
import {
	layoutDuplexCardSheets,
	type DuplexCardForSheet,
	type PageSizeId
} from './printSheet';

/**
 * One PDF with interleaved pages: fronts sheet 1, backs sheet 1, fronts sheet 2, …
 * Print with duplex (flip on long edge) so backs align to fronts.
 */
export async function generateDuplexPrintPdf(
	cards: DuplexCardForSheet[],
	pageSize: PageSizeId
): Promise<Uint8Array> {
	const pairs = await layoutDuplexCardSheets(cards, pageSize);
	const pdf = await PDFDocument.create();
	for (const { front, back } of pairs) {
		const fBytes = await front.arrayBuffer();
		const bBytes = await back.arrayBuffer();
		const fImg = await pdf.embedPng(fBytes);
		const bImg = await pdf.embedPng(bBytes);
		const fw = fImg.width;
		const fh = fImg.height;
		const p1 = pdf.addPage([fw, fh]);
		p1.drawImage(fImg, { x: 0, y: 0, width: fw, height: fh });
		const p2 = pdf.addPage([fw, fh]);
		p2.drawImage(bImg, { x: 0, y: 0, width: fw, height: fh });
	}
	return pdf.save();
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
	const ab = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(ab).set(bytes);
	const blob = new Blob([ab], { type: 'application/pdf' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
