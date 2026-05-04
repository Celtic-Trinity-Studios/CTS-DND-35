/**
 * D&D 3.5 coin wallet helpers (cp/sp/gp/pp). Internal math uses copper pieces.
 */

/** @param {{cp?:number,sp?:number,gp?:number,pp?:number}} w */
export function walletToCp(w) {
  const cp = Math.max(0, Math.floor(Number(w?.cp) || 0));
  const sp = Math.max(0, Math.floor(Number(w?.sp) || 0));
  const gp = Math.max(0, Math.floor(Number(w?.gp) || 0));
  const pp = Math.max(0, Math.floor(Number(w?.pp) || 0));
  return cp + sp * 10 + gp * 100 + pp * 1000;
}

/** @param {number} totalCp */
export function walletFromCp(totalCp) {
  let n = Math.max(0, Math.floor(Number(totalCp) || 0));
  const pp = Math.floor(n / 1000);
  n -= pp * 1000;
  const gp = Math.floor(n / 100);
  n -= gp * 100;
  const sp = Math.floor(n / 10);
  n -= sp * 10;
  return { cp: n, sp, gp, pp };
}

/** GP with fractional part expressed in cp (e.g. 1.5 gp → 150 cp). */
export function gpToCp(gpAmount) {
  return Math.max(0, Math.round((Number(gpAmount) || 0) * 100));
}

/**
 * @param {{cp?:number,sp?:number,gp?:number,pp?:number}} wallet
 * @param {number} costCp
 */
export function canAffordCp(wallet, costCp) {
  return walletToCp(wallet) >= costCp;
}

/**
 * @param {Actor} actor
 * @param {number} costCp
 * @returns {false | { cp:number,sp:number,gp:number,pp:number }}
 */
export function subtractCpFromActorCurrency(actor, costCp) {
  const need = Math.max(0, Math.floor(Number(costCp) || 0));
  const cur = actor?.system?.currency ?? {};
  let total = walletToCp(cur);
  if (total < need) return false;
  total -= need;
  return walletFromCp(total);
}

/**
 * @param {Actor} actor
 * @param {number} addCp
 */
export function addCpToActorCurrency(actor, addCp) {
  const gain = Math.max(0, Math.floor(Number(addCp) || 0));
  const cur = actor?.system?.currency ?? {};
  const total = walletToCp(cur) + gain;
  return walletFromCp(total);
}
