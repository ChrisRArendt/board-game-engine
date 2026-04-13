import JSZip from 'jszip';

export async function zipPngFiles(files: { path: string; blob: Blob }[]): Promise<Blob> {
	const zip = new JSZip();
	for (const f of files) {
		zip.file(f.path, f.blob);
	}
	return zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob: Blob, filename: string) {
	const a = document.createElement('a');
	a.href = URL.createObjectURL(blob);
	a.download = filename;
	a.click();
	URL.revokeObjectURL(a.href);
}
