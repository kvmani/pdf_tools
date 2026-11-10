import * as pdfjs from '../vendor/pdfjs/legacy/build/pdf.mjs';
const root = new URL('../vendor/pdfjs/', import.meta.url).href;
pdfjs.GlobalWorkerOptions.workerSrc = `${root}legacy/build/pdf.worker.mjs`;
export { pdfjs };
export function loadDocument(data) {
    return pdfjs.getDocument({data, cMapUrl: `${root}cmaps/`, cMapPacked: true,
        standardFontDataUrl: `${root}standard_fonts/`, wasmUrl: `${root}wasm/`,
        isEvalSupported: false, enableXfa: false});
}
