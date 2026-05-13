export type PdfType = 'expose' | 'mieterliste' | 'energie' | 'modernisierung' | 'grundriss' | 'sonstiges';

export function classifyPdf(input: { filename: string; text: string }): PdfType {
  const fn = input.filename.toLowerCase();
  const txt = input.text.toLowerCase();

  if (/expos[ée]/.test(fn)) return 'expose';
  if (/mieterliste|mietliste|mietaufstellung/.test(fn)) return 'mieterliste';
  if (/energie(ausweis|pass)|epc/.test(fn)) return 'energie';
  if (/modernisierung|renovierung|sanierung/.test(fn)) return 'modernisierung';
  if (/grundriss|plan/.test(fn)) return 'grundriss';

  if (/endenergiebedarf|energieeffizienzklasse|energieausweis/.test(txt)) return 'energie';
  if (/mieter|nettomiete|wohnfl[äa]che.*miete/.test(txt)) return 'mieterliste';
  if (/wohnfl[äa]che|kaufpreis|baujahr/.test(txt)) return 'expose';

  return 'sonstiges';
}
