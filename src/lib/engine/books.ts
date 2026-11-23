import { BOOKMAKERS } from '#lib/data/catalog';
import { clamp, jitter, round } from './core';

export interface BookPrice {
  id: string;
  name: string;
  shortName: string;
  colour: string;
  odds: number;
}

/** Deterministic per-book prices for an outcome. Mirrors the engine's pricing. */
export function bookPrices(probability: number, key: string): BookPrice[] {
  const p = clamp(probability, 0.0015, 0.996);
  return BOOKMAKERS.map((book, i) => {
    const bias = jitter(`${key}-${book.id}-bias`, 0.065);
    const implied = clamp(p * (1 + book.margin * 0.9) * (1 + bias) * (1 + jitter(`${key}-${book.id}-${i}`, 0.011)), 0.001, 0.999);
    return {
      id: book.id,
      name: book.name,
      shortName: book.shortName,
      colour: book.colour,
      odds: round(Math.max(1.01, 1 / implied), 2)
    };
  });
}

export function bestPrice(probability: number, key: string): BookPrice {
  return bookPrices(probability, key).reduce((a, b) => (b.odds > a.odds ? b : a));
}

/** Best price per outcome and the resulting arbitrage margin (1 - sum of implied). */
export function arbitrage(probabilities: number[], key: string) {
  const outcomes = probabilities.map((p, i) => {
    const price = bestPrice(p, `${key}-${i}`);
    return { ...price, probability: p, implied: 1 / price.odds };
  });
  const totalImplied = outcomes.reduce((a, o) => a + o.implied, 0);
  return {
    outcomes,
    totalImplied: round(totalImplied, 4),
    margin: round(1 - totalImplied, 4),
    isArb: totalImplied < 0.995
  };
}
