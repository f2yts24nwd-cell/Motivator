// Schriften der Plantafel (lokal ausgeliefert, kein Google Fonts, funktioniert offline).
// @font-face muss im Dokument stehen, damit sie auch im Shadow DOM und auf Canvas-Texturen greifen.
const BASE = import.meta.env.BASE_URL;

export const FONT_UI = '"Schibsted Grotesk", -apple-system, "Helvetica Neue", Arial, sans-serif';
export const FONT_NUM = '"Geist Mono", ui-monospace, "SF Mono", Menlo, monospace';

let ready = null;

export function ensureFonts() {
  if (ready) return ready;
  if (!document.getElementById('plantafel-fonts')) {
    const st = document.createElement('style');
    st.id = 'plantafel-fonts';
    st.textContent =
      `@font-face{font-family:"Schibsted Grotesk";src:url("${BASE}plantafel/fonts/schibsted-grotesk.woff") format("woff");font-weight:400 900;font-display:swap}` +
      `@font-face{font-family:"Geist Mono";src:url("${BASE}plantafel/fonts/geist-mono.woff") format("woff");font-weight:100 900;font-display:swap}`;
    document.head.append(st);
  }
  ready = Promise.all([
    document.fonts?.load('700 20px "Schibsted Grotesk"'),
    document.fonts?.load('400 20px "Geist Mono"')
  ]).catch(() => {});
  return ready;
}
