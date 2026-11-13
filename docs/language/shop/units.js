// Wheel sizes are said in inches; the shop's tables are in centimetres.

export function inchesToCm(inches) {
  if (inches <= 0) throw new Error('a wheel has a size');
  return Math.round(inches * 254) / 100;
}

export const sizes = [26, 27.5, 29];
