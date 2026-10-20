'use strict';
function isEligible(a) { return !!(a && a.id && String(a.angkatan ?? '').trim() === '2023'); }
function eligibleOnly(awardees) { if (!Array.isArray(awardees)) throw new TypeError('Expected awardee list'); return awardees.filter(isEligible); }
module.exports = { isEligible, eligibleOnly };
