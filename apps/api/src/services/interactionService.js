import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rulesPath = path.resolve(__dirname, '../../data/rules.json');

const norm = (s) =>
  String(s || '')
    .trim()
    .toLowerCase();

/**
 * Check interactions, overdose, and (optionally) food triggers
 * @param {{meds: Array<{drug:string,doseMg:number,frequencyPerDay:number}>, foods?: string[]}} payload
 */
export function runChecks(payload = {}) {
  const { meds = [], foods = [] } = payload;
  const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

  const messages = [];
  const seen = new Set();

  // interactions (pairwise)
  for (let i = 0; i < meds.length; i++) {
    for (let j = i + 1; j < meds.length; j++) {
      const a = norm(meds[i].drug);
      const b = norm(meds[j].drug);
      for (const r of rules.interactions) {
        const rA = norm(r.a),
          rB = norm(r.b);
        const match = (a === rA && b === rB) || (a === rB && b === rA);
        if (match) {
          const key = `${[a, b].sort().join('+')}:${r.severity}`;
          if (!seen.has(key)) {
            seen.add(key);
            messages.push({
              type: 'interaction',
              severity: r.severity,
              message: r.message,
              pair: [a, b],
            });
          }
        }
      }
    }
  }

  // overdose (sum daily mg per drug)
  const totals = meds.reduce((acc, m) => {
    const k = norm(m.drug);
    const total = (Number(m.doseMg) || 0) * (Number(m.frequencyPerDay) || 0);
    acc[k] = (acc[k] || 0) + total;
    return acc;
  }, {});

  for (const r of rules.overdose) {
    const k = norm(r.drug);
    const total = totals[k] || 0;
    if (total > r.maxDailyMg) {
      messages.push({
        type: 'overdose',
        severity: 'high',
        message: `${r.message} You entered ~${total} mg/day.`,
        drug: k,
        maxDailyMg: r.maxDailyMg,
        totalMg: total,
      });
    }
  }

  // food triggers
  const foodsNorm = foods.map(norm);
  for (const r of rules.food) {
    const d = norm(r.drug);
    if (meds.some((m) => norm(m.drug) === d)) {
      if (foodsNorm.includes(norm(r.trigger))) {
        messages.push({
          type: 'food',
          severity: 'moderate',
          message: r.message,
          drug: d,
          trigger: r.trigger,
        });
      }
    }
  }

  return messages;
}
