// Smoke test for the assessment engine (run: npx tsx scripts/test-assessment-engine.ts)
import { validateScores, aggregateScores, detectDeficits, suggestGoals } from '../src/services/assessmentEngine';

const vbScores = [
  { itemCode: 'MAND_L1_1', domainCode: 'MAND', level: 1, score: 1 },
  { itemCode: 'MAND_L1_2', domainCode: 'MAND', level: 1, score: 0.5 },
  { itemCode: 'TACT_L1_1', domainCode: 'TACT', level: 1, score: 0 },
  { itemCode: 'SOCIAL_L1_1', domainCode: 'SOCIAL', level: 1, score: 1 },
];

const abllsScores = [
  { itemCode: 'A_1', domainCode: 'A', level: 0, score: 2 },
  { itemCode: 'A_2', domainCode: 'A', level: 0, score: 4 },
  { itemCode: 'C_1', domainCode: 'C', level: 0, score: 0 },
];

console.log('validate VB (expect valid):', validateScores('VB_MAPP_GRID', vbScores).valid);
console.log('validate invalid 0.7 (expect fail):', validateScores('VB_MAPP_GRID', [{ itemCode: 'MAND_L1_3', domainCode: 'MAND', level: 1, score: 0.7 }]).valid);
console.log('validate ABLLS (expect valid):', validateScores('ABLLS_GRID', abllsScores).valid);

const agg = aggregateScores('VB_MAPP_GRID', vbScores);
console.log('VB total:', agg.totalScore, '/', agg.totalMax, '=', agg.percentage + '%');
console.log('VB MAND domain:', JSON.stringify(agg.domainTotals.find((d) => d.code === 'MAND')));

const aggA = aggregateScores('ABLLS_GRID', abllsScores);
console.log('ABLLS total:', aggA.totalScore, '/', aggA.totalMax, '=', aggA.percentage + '%');

console.log('VB deficits:', detectDeficits('VB_MAPP_GRID', vbScores).map((d) => d.itemCode).join(', '));

console.log('VB suggestions:', suggestGoals('VB_MAPP_GRID', vbScores, agg.domainTotals, 5).map((g) => `${g.targetId} (${g.reason.slice(0, 30)})`));
console.log('ABLLS suggestions:', suggestGoals('ABLLS_GRID', abllsScores, aggA.domainTotals, 5).map((g) => g.targetId));
