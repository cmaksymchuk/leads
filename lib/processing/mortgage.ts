export function parsePurchaseDate(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error("invalid purchase_date");
  }
  return d;
}

/** Five-year term assumption (MVP). */
export function renewalDateFromPurchase(purchaseDate: Date): Date {
  const d = new Date(purchaseDate.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + 5);
  return d;
}

/** Full calendar months from now to target (negative if target is in the past). */
export function fullMonthsFromNowTo(target: Date): number {
  const from = new Date();
  let months =
    (target.getFullYear() - from.getFullYear()) * 12 +
    (target.getMonth() - from.getMonth());
  if (target.getDate() < from.getDate()) {
    months -= 1;
  }
  return months;
}

export function computeMortgageBalance(purchasePrice: number): number {
  return purchasePrice * 0.8;
}

/** MVP simplified monthly payment shock estimate. */
export function computePaymentShock(mortgageBalance: number): number {
  return (0.0235 * mortgageBalance) / 12;
}

export function computeLeadScore(
  monthsToRenewal: number,
  paymentShock: number,
): number {
  let score = 0;
  if (monthsToRenewal >= 0 && monthsToRenewal < 3) {
    score += 60;
  } else if (monthsToRenewal >= 0 && monthsToRenewal < 6) {
    score += 40;
  }

  if (paymentShock > 1000) {
    score += 40;
  } else if (paymentShock > 500) {
    score += 25;
  }
  return score;
}

export function shouldPromoteLead(score: number, monthsToRenewal: number): boolean {
  return score >= 60 && monthsToRenewal >= 0 && monthsToRenewal <= 6;
}
