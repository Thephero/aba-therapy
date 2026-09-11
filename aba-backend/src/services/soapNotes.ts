import { prisma } from '../utils/prisma';

interface SOAPNoteContent {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

/**
 * Auto-draft a SOAP note from session data.
 */
export async function generateSOAPNote(sessionId: string): Promise<SOAPNoteContent> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      student: { select: { id: true, name: true } },
      therapist: true,
      trials: {
        include: {
          target: { include: { program: true } },
        },
      },
      behaviorRecords: true,
      mandRecords: true,
      programs: { include: { program: { include: { targets: true } } } },
    },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  const studentName = session.student?.name || 'the student';
  const totalTrials = session.trials.length;
  const correctTrials = session.trials.filter((t) => t.correct === true).length;
  const incorrectTrials = session.trials.filter((t) => t.correct === false).length;
  const promptedTrials = session.trials.filter((t) => t.promptLevelUsed !== null).length;
  const accuracy = totalTrials > 0 ? Math.round((correctTrials / totalTrials) * 100) : 0;
  const behaviorCount = session.behaviorRecords.length;
  const mandCount = session.mandRecords.length;

  // DTT vs NET
  const dttTrials = session.trials.filter((t) => t.trialType === 'DTT');
  const netTrials = session.trials.filter((t) => t.trialType === 'NET');

  // Per-program breakdown: group targets (and their trials) by program.
  const programMap = new Map<string, { programName: string; correct: number; total: number; targets: Set<string> }>();
  for (const trial of session.trials) {
    const program = trial.target?.program;
    const programName = program?.name || 'Unassigned'; // target w/o a program
    if (!programMap.has(programName)) {
      programMap.set(programName, { programName, correct: 0, total: 0, targets: new Set() });
    }
    const entry = programMap.get(programName)!;
    entry.total++;
    if (trial.correct === true) entry.correct++;
    if (trial.target?.skill) entry.targets.add(trial.target.skill);
  }

  let programSummary = '';
  programMap.forEach((entry) => {
    const pct = entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0;
    programSummary += `- ${entry.programName}: ${entry.correct}/${entry.total} correct (${pct}%) — targets: ${Array.from(entry.targets).join(', ') || '—'}\n`;
  });

  const subjective = `Session with ${studentName}. ${totalTrials > 0 ? `A total of ${totalTrials} trials were conducted across ${programMap.size} program(s).` : 'No formal trials were recorded.'}`;

  const objective = [
    `DTT Trials: ${dttTrials.length} | NET Trials: ${netTrials.length}`,
    `Total Trials: ${totalTrials}`,
    `Correct: ${correctTrials} | Incorrect: ${incorrectTrials} | Prompted: ${promptedTrials}`,
    `Overall Accuracy: ${accuracy}%`,
    '',
    `Program Breakdown:`,
    programSummary || 'N/A',
    '',
    `Behavior Incidents: ${behaviorCount}`,
    `Mands Recorded: ${mandCount}`,
    `Duration: ${session.startedAt && session.endedAt ? Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 60000) + ' minutes' : 'In progress'}`,
  ].join('\n');

  const assessment = accuracy >= 80
    ? `${studentName} demonstrated good progress with ${accuracy}% accuracy. ${promptedTrials > 0 ? 'Prompts were used as needed with fading.' : 'Independent responding was observed.'}`
    : `${studentName} is making progress but requires continued support. Current accuracy is ${accuracy}%. Targeted prompting and reinforcement recommended.`;

  const plan = `Continue current programming with focus on targets below 80% mastery. Include maintenance trials for mastered targets. Supervisor review recommended.`;

  return { subjective, objective, assessment, plan };
}

/**
 * Save a draft SOAP note to the session using upsert (race-condition safe).
 */
export async function saveSOAPNoteDraft(sessionId: string): Promise<void> {
  const note = await generateSOAPNote(sessionId);

  const soapText = `SUBJECTIVE:\n${note.subjective}\n\nOBJECTIVE:\n${note.objective}\n\nASSESSMENT:\n${note.assessment}\n\nPLAN:\n${note.plan}`;

  // Update session notes
  await prisma.session.update({
    where: { id: sessionId },
    data: { notes: soapText },
  });

  // Upsert SOAPNote (race-condition safe)
  await prisma.sOAPNote.upsert({
    where: { sessionId },
    create: {
      sessionId,
      subjective: note.subjective,
      objective: note.objective,
      assessment: note.assessment,
      plan: note.plan,
      autoDrafted: true,
      isFinalized: false,
    },
    update: {
      subjective: note.subjective,
      objective: note.objective,
      assessment: note.assessment,
      plan: note.plan,
      autoDrafted: true,
    },
  });
}
