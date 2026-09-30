/**
 * Indian Number to Words Utility for Currency Representation
 * Example: 210000 -> "Rupees Two Lakh Ten Thousand Only"
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

const convertTwoDigits = (n) => {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return TENS[tens] + (ones ? ' ' + ONES[ones] : '');
};

const convertThreeDigits = (n) => {
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  let res = '';
  if (hundreds > 0) {
    res += ONES[hundreds] + ' Hundred';
    if (remainder > 0) res += ' ';
  }
  if (remainder > 0) {
    res += convertTwoDigits(remainder);
  }
  return res.trim();
};

/**
 * Converts a positive number up to 99,99,99,999 to Indian words
 * @param {number} num
 * @returns {string}
 */
const convertIndianNumber = (num) => {
  if (num === 0) return 'Zero';

  const crore = Math.floor(num / 10000000);
  num %= 10000000;

  const lakh = Math.floor(num / 100000);
  num %= 100000;

  const thousand = Math.floor(num / 1000);
  num %= 1000;

  const hundredAndBelow = num;

  const parts = [];

  if (crore > 0) {
    parts.push(convertThreeDigits(crore) + ' Crore');
  }
  if (lakh > 0) {
    parts.push(convertTwoDigits(lakh) + ' Lakh');
  }
  if (thousand > 0) {
    parts.push(convertTwoDigits(thousand) + ' Thousand');
  }
  if (hundredAndBelow > 0) {
    parts.push(convertThreeDigits(hundredAndBelow));
  }

  return parts.join(' ').trim();
};

/**
 * Convert numeric amount to formal Indian currency words string
 * @param {number} amount
 * @returns {string} e.g. "Rupees Two Lakh Ten Thousand Only"
 */
const amountToWords = (amount) => {
  const num = Math.round(Number(amount || 0) * 100) / 100;
  if (isNaN(num) || num <= 0) {
    return 'Rupees Zero Only';
  }

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  const rupeesWords = convertIndianNumber(integerPart);
  let result = `Rupees ${rupeesWords}`;

  if (decimalPart > 0) {
    const paiseWords = convertTwoDigits(decimalPart);
    result += ` and ${paiseWords} Paise`;
  }

  return `${result} Only`;
};

module.exports = {
  amountToWords
};
