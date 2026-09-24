/** All money arithmetic is done in integer paise to avoid floating point drift. */
export const toPaise = (rupees: number | string) => Math.round(Number(rupees) * 100);
export const toRupees = (paise: number) => Math.round(paise) / 100;
export const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
