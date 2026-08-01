import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { checkAndSaveAlerts } from '../services/ruleEngine';
import { generateSOAPNote, saveSOAPNoteDraft } from '../services/soapNotes';
import { authenticate } from '../middleware/auth';

const router = Router();

// Get all alerts for a session
router.get('/sessions/:id/alerts', authenticate, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id as string;
    const alerts = await prisma.alert.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ alerts });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Evaluate rules for a session and return new alerts
router.post('/sessions/:id/evaluate', authenticate, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id as string;
    const alerts = await checkAndSaveAlerts(sessionId);
    res.json({ alerts });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Resolve an alert
router.patch('/alerts/:id/resolve', authenticate, async (req: Request, res: Response) => {
  try {
    const alertId = req.params.id as string;
    const alert = await prisma.alert.update({
      where: { id: alertId },
      data: { isResolved: true },
    });
    res.json({ alert });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Generate SOAP note draft for a session (no save)
router.post('/sessions/:id/generate-soap', authenticate, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id as string;
    const note = await generateSOAPNote(sessionId);
    res.json({ note });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save SOAP note draft to session
router.post('/sessions/:id/save-soap', authenticate, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id as string;
    await saveSOAPNoteDraft(sessionId);
    res.json({ success: true, message: 'SOAP note draft saved' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update SOAP note
router.patch('/sessions/:id/soap-note', authenticate, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id as string;
    const body = req.body as Record<string, any>;
    const { subjective, objective, assessment, plan, isFinalized } = body;

    const note = await prisma.sOAPNote.update({
      where: { sessionId },
      data: {
        ...(subjective && { subjective }),
        ...(objective && { objective }),
        ...(assessment && { assessment }),
        ...(plan && { plan }),
        ...(isFinalized !== undefined && { isFinalized }),
      },
    });

    // Update session notes
    const soapText = `SUBJECTIVE:\n${note.subjective}\n\nOBJECTIVE:\n${note.objective}\n\nASSESSMENT:\n${note.assessment}\n\nPLAN:\n${note.plan}`;
    await prisma.session.update({
      where: { id: sessionId },
      data: { notes: soapText },
    });

    res.json({ note });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Supervisor co-sign SOAP note
router.post('/sessions/:id/sign-note', authenticate, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id as string;
    const body = req.body as Record<string, any>;
    const coSignedById = body.coSignedById || (req as any).user?.id;

    const note = await prisma.sOAPNote.update({
      where: { sessionId },
      data: {
        coSignedById,
        coSignedAt: new Date(),
        isFinalized: true,
      },
    });

    res.json({ note });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
