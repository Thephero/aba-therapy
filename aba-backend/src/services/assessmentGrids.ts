// ─── Clinical Assessment Grid Definitions & Universal Goal Bank ──────────────
// Generic domain names and scoring structures only — no copyrighted item text.

export const VBMAPP_SCORE_SCALE = [0, 0.5, 1];

export const ABLLS_SCORE_SCALE = [0, 1, 2, 3, 4];

export const VBMAPP_ATTEMPT_COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0'];

export interface GridDomain {
  code: string;
  name: string;
  totalItems: number;
}

export interface GridLevel {
  level: number;
  ageRangeMonths: string;
  maxScorePerDomain: number;
  domains: GridDomain[];
}

export interface GridDefinition {
  assessmentType: 'VB_MAPP_GRID' | 'ABLLS_GRID';
  label: string;
  scoringScale: number[];
  colorLegendByAssessment?: string[];
  levels?: GridLevel[];
  domainsAtoZ?: GridDomain[];
  maxScorePerItem: number;
  totalItems: number;
}

const five = () => 5;

// ── VB-MAPP: 3 levels, each with 5 items per domain ─────────────────────────
export const VBMAPP_LEVELS: GridLevel[] = [
  {
    level: 1,
    ageRangeMonths: '0-18',
    maxScorePerDomain: 5,
    domains: [
      { code: 'MAND', name: 'Mand Domain', totalItems: five() },
      { code: 'TACT', name: 'Tact Domain', totalItems: five() },
      { code: 'ECHOIC', name: 'Echoic Domain', totalItems: five() },
      { code: 'VP_MATCH', name: 'Visual Perception & Matching', totalItems: five() },
      { code: 'INDEPENDENT_PLAY', name: 'Independent Play', totalItems: five() },
      { code: 'SOCIAL', name: 'Social Behavior & Play', totalItems: five() },
      { code: 'MOTOR_IMITATION', name: 'Motor Imitation', totalItems: five() },
      { code: 'LISTENER_RESP', name: 'Listener Responding', totalItems: five() },
      { code: 'VOCAL', name: 'Spontaneous Vocal Behavior', totalItems: five() },
    ],
  },
  {
    level: 2,
    ageRangeMonths: '18-30',
    maxScorePerDomain: 5,
    domains: [
      { code: 'MAND', name: 'Mand Domain', totalItems: five() },
      { code: 'TACT', name: 'Tact Domain', totalItems: five() },
      { code: 'LISTENER_RESP', name: 'Listener Responding', totalItems: five() },
      { code: 'VP_MATCH', name: 'Visual Perception & Matching', totalItems: five() },
      { code: 'INDEPENDENT_PLAY', name: 'Independent Play', totalItems: five() },
      { code: 'SOCIAL', name: 'Social Behavior & Play', totalItems: five() },
      { code: 'MOTOR_IMITATION', name: 'Motor Imitation', totalItems: five() },
      { code: 'LRFFC', name: 'Listener Responding by Function, Feature, Class', totalItems: five() },
      { code: 'INTRAVERBAL', name: 'Intraverbal Domain', totalItems: five() },
      { code: 'CLASSROOM_ROUTINES', name: 'Classroom Routines & Group Skills', totalItems: five() },
      { code: 'LINGUISTIC', name: 'Linguistic Structure', totalItems: five() },
    ],
  },
  {
    level: 3,
    ageRangeMonths: '30-48',
    maxScorePerDomain: 5,
    domains: [
      { code: 'MAND', name: 'Mand Domain', totalItems: five() },
      { code: 'TACT', name: 'Tact Domain', totalItems: five() },
      { code: 'LISTENER_RESP', name: 'Listener Responding', totalItems: five() },
      { code: 'VP_MATCH', name: 'Visual Perception & Matching', totalItems: five() },
      {code: 'INDEPENDENT_PLAY', name: 'Independent Play', totalItems: five() },
      { code: 'SOCIAL', name: 'Social Behavior & Play', totalItems: five() },
      { code: 'LRFFC', name: 'Listener Responding by Function, Feature, Class', totalItems: five() },
      { code: 'INTRAVERBAL', name: 'Intraverbal Domain', totalItems: five() },
      { code: 'CLASSROOM_ROUTINES', name: 'Classroom Routines & Group Skills', totalItems: five() },
      { code: 'LINGUISTIC', name: 'Linguistic Structure', totalItems: five() },
      { code: 'READING', name: 'Reading Domain', totalItems: five() },
      { code: 'WRITING', name: 'Writing Domain', totalItems: five() },
      { code: 'MATH', name: 'Math Domain', totalItems: five() },
    ],
  },
];

// ── ABLLS: domains A–Y, 5 tracked tasks per domain ──────────────────────────
export const ABLLS_DOMAINS: GridDomain[] = [
  'Cooperation & Reinforcer Effectiveness|A',
  'Visual Performance|B',
  'Receptive Language|C',
  'Motor Imitation|D',
  'Vocal Imitation|E',
  'Requests (Mands)|F',
  'Labeling (Tacts)|G',
  'Intraverbals|H',
  'Spontaneous Vocalizations|I',
  'Syntax & Grammar|J',
  'Play & Leisure|K',
  'Social Interaction|L',
  'Group Instruction|M',
  'Classroom Routines|N',
  'Generalized Responding|O',
  'Reading Skills|P',
  'Math Skills|Q',
  'Writing Skills|R',
  'Spelling Skills|S',
  'Dressing Skills|T',
  'Eating Skills|U',
  'Grooming Skills|V',
  'Toileting Skills|W',
  'Gross Motor Skills|X',
  'Fine Motor Skills|Y',
].map((entry) => {
  const [name, code] = entry.split('|');
  return { code, name, totalItems: five() };
});

export const VBMAPP_GRID: GridDefinition = {
  assessmentType: 'VB_MAPP_GRID',
  label: 'VB-MAPP Grid',
  scoringScale: VBMAPP_SCORE_SCALE,
  colorLegendByAssessment: VBMAPP_ATTEMPT_COLORS,
  levels: VBMAPP_LEVELS,
  maxScorePerItem: 1,
  totalItems: VBMAPP_LEVELS.reduce(
    (sum, lvl) => sum + lvl.domains.reduce((s, d) => s + d.totalItems, 0),
    0
  ),
};

export const ABLLS_GRID: GridDefinition = {
  assessmentType: 'ABLLS_GRID',
  label: 'ABLLS-R Grid',
  scoringScale: ABLLS_SCORE_SCALE,
  domainsAtoZ: ABLLS_DOMAINS,
  maxScorePerItem: 4,
  totalItems: ABLLS_DOMAINS.reduce((s, d) => s + d.totalItems, 0),
};

export const GRIDS: Record<string, GridDefinition> = {
  VB_MAPP_GRID: VBMAPP_GRID,
  ABLLS_GRID: ABLLS_GRID,
};

// ── Universal Goal Bank ──────────────────────────────────────────────────────
export interface GoalBankEntry {
  category: string;
  targetId: string;
  behaviorName?: string;
  goalTitle?: string;
  operationalDefinition: string;
  measurementType: string;
  promptLevels?: string[];
  taskSteps?: string[];
  commonFunctions?: string[];
  replacementBehaviors?: string[];
  defaultMasteryCriteria: string;
  // Which assessment domains this goal maps to
  mapsToDomainCodes?: string[];
}

export const GOAL_BANK: GoalBankEntry[] = [
  {
    category: 'Behavior Reduction (BIP Targets)',
    targetId: 'BEH_001',
    behaviorName: 'Physical Aggression',
    operationalDefinition:
      'Any instance of making forceful physical contact with another person using a closed/open hand, foot, or object (e.g., hitting, kicking, biting) from a distance of within 3 feet.',
    measurementType: 'Frequency / Rate',
    commonFunctions: ['Escape', 'Attention', 'Access to Tangibles'],
    replacementBehaviors: ['Functional Communication Training (FCT) - Manding for Break'],
    defaultMasteryCriteria: 'Zero occurrences across 5 consecutive sessions',
    mapsToDomainCodes: ['SOCIAL'],
  },
  {
    category: 'Behavior Reduction (BIP Targets)',
    targetId: 'BEH_002',
    behaviorName: 'Elopement / Running Away',
    operationalDefinition:
      'Moving more than 5 feet away from the designated instructor or area without permission in an indoor or outdoor environment.',
    measurementType: 'Frequency / Latency',
    commonFunctions: ['Escape', 'Automatic/Sensory'],
    replacementBehaviors: ["Asking for 'Stop' or 'Wait' / Using Token System"],
    defaultMasteryCriteria: '0 instances of unauthorized elopement for 10 consecutive sessions',
    mapsToDomainCodes: ['CLASSROOM_ROUTINES'],
  },
  {
    category: 'Skill Acquisition - Communication',
    targetId: 'SKILL_001',
    goalTitle: 'Mand / Requesting Preferred Items',
    operationalDefinition:
      'Learner will independently request desired items/activities using PECS/Vocal/AAC within 5 seconds of item visibility without verbal prompts.',
    measurementType: 'Trial-by-Trial / Prompt Hierarchy',
    promptLevels: ['Independent', 'Gestural', 'Verbal', 'Full Physical'],
    defaultMasteryCriteria: '80% independent accuracy across 3 consecutive sessions with 2 different staff',
    mapsToDomainCodes: ['MAND'],
  },
  {
    category: 'Skill Acquisition - Social & Play',
    targetId: 'SKILL_002',
    goalTitle: 'Turn-Taking in Structured Games',
    operationalDefinition:
      "Learner will take turns with a peer in a 2-player board/table game, waiting for peer's turn without vocal/physical disruption.",
    measurementType: 'Percentage of Opportunities',
    defaultMasteryCriteria: '90% correct unprompted turn-taking across 4 consecutive game sessions',
    mapsToDomainCodes: ['SOCIAL', 'INDEPENDENT_PLAY'],
  },
  {
    category: 'Skill Acquisition - Daily Living (ADL)',
    targetId: 'SKILL_003',
    goalTitle: 'Handwashing Chain',
    operationalDefinition:
      "Learner will complete all 7 steps of the handwashing task analysis independently upon the initial directive 'Wash your hands'.",
    measurementType: 'Task Analysis (Forward/Backward Chaining)',
    taskSteps: ['Turn on water', 'Wet hands', 'Apply soap', 'Rub hands for 15 seconds', 'Rinse hands', 'Turn off water', 'Dry hands with towel'],
    defaultMasteryCriteria: '100% independent step completion across 3 consecutive trials',
    mapsToDomainCodes: ['CLASSROOM_ROUTINES'],
  },
  {
    category: 'Skill Acquisition - Communication',
    targetId: 'SKILL_004',
    goalTitle: 'Labeling / Naming Common Items',
    operationalDefinition:
      'Learner will label (tact) common objects, pictures, and actions with 80% independent accuracy during structured teaching trials.',
    measurementType: 'Trial-by-Trial / Prompt Hierarchy',
    promptLevels: ['Independent', 'Gestural', 'Verbal', 'Full Physical'],
    defaultMasteryCriteria: '80% independent accuracy across 3 consecutive sessions with 2 different staff',
    mapsToDomainCodes: ['TACT', 'ECHOIC'],
  },
  {
    category: 'Skill Acquisition - Communication',
    targetId: 'SKILL_005',
    goalTitle: 'Listener Responding — Following Instructions',
    operationalDefinition:
      'Learner will follow one- and two-step instructions delivered by an adult in structured and natural environment contexts.',
    measurementType: 'Percentage of Opportunities',
    defaultMasteryCriteria: '80% independent responding across 3 consecutive sessions',
    mapsToDomainCodes: ['LISTENER_RESP', 'LRFFC', 'CLASSROOM_ROUTINES'],
  },
  {
    category: 'Skill Acquisition - Imitation',
    targetId: 'SKILL_006',
    goalTitle: 'Motor Imitation of Peer Models',
    operationalDefinition:
      'Learner will imitate gross and fine motor actions modeled by an adult or peer within 5 seconds of the model, without physical prompting.',
    measurementType: 'Trial-by-Trial / Prompt Hierarchy',
    promptLevels: ['Independent', 'Gestural', 'Model', 'Full Physical'],
    defaultMasteryCriteria: '80% independent imitation across 3 consecutive sessions',
    mapsToDomainCodes: ['MOTOR_IMITATION', 'VOCAL', 'ECHOIC'],
  },
  {
    category: 'Skill Acquisition - Pre-Academic',
    targetId: 'SKILL_007',
    goalTitle: 'Matching & Visual Discrimination',
    operationalDefinition:
      'Learner will match identical objects and pictures in a field of increasing size, and sort items by class, function, or feature.',
    measurementType: 'Trial-by-Trial',
    defaultMasteryCriteria: '80% independent accuracy across 3 consecutive sessions',
    mapsToDomainCodes: ['VP_MATCH', 'READING', 'WRITING', 'MATH', 'LINGUISTIC', 'INTRAVERBAL', 'B'],
  },
  {
    category: 'Skill Acquisition - Play & Leisure',
    targetId: 'SKILL_008',
    goalTitle: 'Independent Play with Structured Materials',
    operationalDefinition:
      'Learner will engage appropriately with leisure materials independently for a minimum of 5 minutes without adult redirection.',
    measurementType: 'Duration / Momentary Time Sampling',
    defaultMasteryCriteria: 'Independent engagement across 4 consecutive sessions',
    mapsToDomainCodes: ['INDEPENDENT_PLAY', 'SOCIAL'],
  },
  {
    category: 'Skill Acquisition - Daily Living (ADL)',
    targetId: 'SKILL_009',
    goalTitle: 'Self-Help / Dressing Skills',
    operationalDefinition:
      'Learner will complete dressing-related task analysis steps (e.g., putting on jacket, shoes) independently upon the initial directive.',
    measurementType: 'Task Analysis (Forward/Backward Chaining)',
    defaultMasteryCriteria: '100% independent step completion across 3 consecutive trials',
    mapsToDomainCodes: ['T', 'U', 'V', 'W', 'X', 'Y'],
  },
];

// Domain code → ABLLS letter mapping helper (e.g. ABLLS_A → 'A')
export function abllsDomainCode(letter: string): string {
  return `ABLLS_${letter}`;
}
