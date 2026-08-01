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
      student: true,
      therapist: true,
      trials: {
        include: { target: true },
      },
      behaviorRecords: true,
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

  // DTT vs NET
  const dttTrials = session.trials.filter((t) => t.trialType === 'DTT');
  const netTrials = session.trials.filter((t) => t.trialType === 'NET');

  // Target breakdown
  const targetMap = new Map<string, { correct: number; total: number; name: string }>();
  for (const trial of session.trials) {
    const targetId = trial.targetId;
    if (!targetId) continue;
    if (!targetMap.has(targetId)) {
      targetMap.set(targetId, {
        correct: 0,
        total: 0,
        name: trial.target?.skill || trial.target?.domain || 'Unknown',
      });
    }
    const entry = targetMap.get(targetId)!;
    entry.total++;
    if (trial.correct === true) entry.correct++;
  }

  let targetSummary = '';
  targetMap.forEach((entry) => {
    const pct = entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0;
    targetSummary += `- ${entry.name}: ${entry.correct}/${entry.total} correct (${pct}%)\n`;
  });

  const subjective = `Session with ${studentName}. ${totalTrials > 0 ? `A total of ${totalTrials} trials were conducted across ${targetMap.size} target(s).` : 'No formal trials were recorded.'}`;

  const objective = [
    `DTT Trials: ${dttTrials.length} | NET Trials: ${netTrials.length}`,
    `Total Trials: ${totalTrials}`,
    `Correct: ${correctTrials} | Incorrect: ${incorrectTrials} | Prompted: ${promptedTrials}`,
    `Overall Accuracy: ${accuracy}%`,
    '',
    `Target Breakdown:`,
    targetSummary || 'N/A',
    '',
    `Behavior Incidents: ${behaviorCount}`,
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
