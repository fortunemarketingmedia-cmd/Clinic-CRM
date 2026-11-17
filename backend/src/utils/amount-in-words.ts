const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(value: number) {
  return value < 20 ? ones[value] : `${tens[Math.floor(value / 10)]}${value % 10 ? ` ${ones[value % 10]}` : ''}`;
}

function belowThousand(value: number) {
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  return [hundreds ? `${ones[hundreds]} Hundred` : '', rest ? belowHundred(rest) : ''].filter(Boolean).join(' ');
}

/** Whole-number words using the Indian grouping (thousand, lakh, crore). */
function integerWords(value: number): string {
  if (value === 0) return 'Zero';
  const crore = Math.floor(value / 10_000_000);
  const lakh = Math.floor((value % 10_000_000) / 100_000);
  const thousand = Math.floor((value % 100_000) / 1_000);
  const rest = value % 1_000;
  return [
    crore ? `${integerWords(crore)} Crore` : '',
    lakh ? `${belowHundred(lakh)} Lakh` : '',
    thousand ? `${belowHundred(thousand)} Thousand` : '',
    rest ? belowThousand(rest) : '',
  ].filter(Boolean).join(' ');
}

/** "Rupees One Thousand Two Hundred and Fifty Paise Only" for invoice totals. */
export function amountInWords(amount: number) {
  const safe = Math.max(0, Math.round((Number.isFinite(amount) ? amount : 0) * 100));
  const rupees = Math.floor(safe / 100);
  const paise = safe % 100;
  const rupeeText = `Rupees ${integerWords(rupees)}`;
  return paise ? `${rupeeText} and ${belowHundred(paise)} Paise Only` : `${rupeeText} Only`;
}
