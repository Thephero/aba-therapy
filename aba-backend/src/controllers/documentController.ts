import { prisma } from '../utils/prisma';
import { canAccessStudent, getStudentScope } from '../utils/access';
import { Request, Response, NextFunction } from 'express';
import { storageEnabled, putObject, getDownloadUrl, deleteObject } from '../utils/storage';

// ─── Documents per student (reports, letters, invoices) ────────────────────
// MVP storage: files are stored base64 in the DB (small docs) — swap for
// S3/Azure Blob later by replacing the store/load functions only.

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_TYPES = [
  'medical_report', 'progress_report', 'invoice', 'letter', 'consent', 'other',
];

export async function listDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const { studentId } = req.query as Record<string, string>;

    let scope: Record<string, any>;
    if (user.role === 'PARENT') {
      scope = { parentId: user.userId, isActive: true };
      if (studentId) {
        if (!(await canAccessStudent(user, studentId))) {
          res.status(403).json({ error: 'You do not have access to this student' });
          return;
        }
        scope.id = studentId;
      }
    } else {
      scope = await getStudentScope(user);
      if (studentId) {
        if (!(await canAccessStudent(user, studentId))) {
          res.status(403).json({ error: 'You do not have access to this student' });
          return;
        }
        scope = { ...scope, id: studentId };
      }
    }

    const students = await prisma.student.findMany({
      where: scope,
      select: { id: true },
    });

    const records = await prisma.documentUpload.findMany({
      where: { studentId: { in: students.map((s) => s.id) } },
      include: {
        student: { select: { id: true, name: true } },
        uploadedBy: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      documents: records.map((d) => ({
        id: d.id,
        studentId: d.studentId,
        studentName: d.student.name,
        fileName: d.fileName,
        fileType: d.fileType,
        mimeType: d.mimeType,
        fileSize: d.fileSize,
        notes: d.notes,
        uploadedByName: d.uploadedBy.name,
        createdAt: d.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    if (user.role === 'PARENT') {
      res.status(403).json({ error: 'Only staff can upload documents' });
      return;
    }

    const body = req.body as Record<string, any>;
    const { studentId, fileName, fileType, contentBase64, mimeType, notes } = body;

    if (!studentId || !(await canAccessStudent(user, studentId))) {
      res.status(403).json({ error: 'You do not have access to this student' });
      return;
    }
    if (!fileName || !contentBase64) {
      res.status(400).json({ error: 'fileName and contentBase64 are required' });
      return;
    }
    if (!ALLOWED_TYPES.includes(fileType)) {
      res.status(400).json({ error: `fileType must be one of: ${ALLOWED_TYPES.join(', ')}` });
      return;
    }

    const sizeBytes = Math.floor((contentBase64.length * 3) / 4);
    if (sizeBytes > MAX_FILE_BYTES) {
      res.status(413).json({ error: 'File is too large (max 5 MB)' });
      return;
    }

    const doc = await prisma.documentUpload.create({
      data: {
        studentId,
        uploadedById: user.userId,
        fileName: String(fileName).slice(0, 255),
        fileUrl: 'inline', // MVP: content is stored in mimeType/content fields below
        fileType,
        mimeType: mimeType || 'application/octet-stream',
        fileSize: sizeBytes,
        notes: notes || undefined,
      },
    });

    if (storageEnabled()) {
      // Object storage (R2): the file is never stored in the database.
      const safeName = String(fileName).replace(/[^A-Za-z0-9._-]/g, '_');
      const key = `documents/${doc.id}/${safeName}`;
      try {
        await putObject(key, Buffer.from(contentBase64, 'base64'), mimeType || 'application/octet-stream');
        await prisma.documentUpload.update({
          where: { id: doc.id },
          data: { fileUrl: key },
        });
      } catch (storageErr) {
        // Bucket upload failed — don't keep a dead metadata row.
        await prisma.documentUpload.delete({ where: { id: doc.id } }).catch(() => {});
        next(storageErr);
        return;
      }
    } else if (sizeBytes <= 1024 * 1024) {
      // Legacy fallback (no bucket configured): small files inline as a data URI.
      await prisma.documentUpload.update({
        where: { id: doc.id },
        data: { fileUrl: `data:${mimeType || 'application/octet-stream'};base64,${contentBase64}` },
      });
    } else {
      // No storage configured and file too big to inline: keep metadata only.
      await prisma.documentUpload.update({
        where: { id: doc.id },
        data: { fileUrl: '', notes: `${notes ? notes + ' — ' : ''}File content shared outside the app (too large for in-app storage).` },
      });
    }

    res.status(201).json({
      document: {
        id: doc.id,
        studentId,
        fileName: doc.fileName,
        fileType: doc.fileType,
        fileSize: sizeBytes,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function downloadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const id = req.params.id as string;

    const doc = await prisma.documentUpload.findUnique({
      where: { id },
      include: { student: { select: { id: true } } },
    });
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }
    if (!(await canAccessStudent(user, doc.student.id))) {
      res.status(403).json({ error: 'You do not have access to this document' });
      return;
    }

    if (doc.fileUrl.startsWith('data:')) {
      const match = /^data:([^;]+);base64,(.*)$/.exec(doc.fileUrl);
      if (!match) {
        res.status(500).json({ error: 'Stored document is unreadable' });
        return;
      }
      const [, mime, base64] = match;
      res.json({ fileName: doc.fileName, mimeType: mime, contentBase64: base64 });
      return;
    }

    // Object-stored docs: fileUrl holds the object key — hand back a signed URL.
    if (doc.fileUrl && storageEnabled()) {
      const url = await getDownloadUrl(doc.fileUrl, doc.fileName).catch(() => null);
      if (url) {
        res.json({ fileName: doc.fileName, mimeType: doc.mimeType, url });
        return;
      }
    }

    res.json({ fileName: doc.fileName, mimeType: null, contentBase64: null });
  } catch (error) {
    next(error);
  }
}

export async function deleteDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    if (user.role === 'PARENT') {
      res.status(403).json({ error: 'Only staff can delete documents' });
      return;
    }
    const doc = await prisma.documentUpload.findUnique({
      where: { id: req.params.id as string },
      include: { student: { select: { id: true } } },
    });
    if (!doc || !(await canAccessStudent(user, doc.student.id))) {
      res.status(403).json({ error: 'You do not have access to this document' });
      return;
    }
    if (doc.fileUrl && !doc.fileUrl.startsWith('data:')) {
      await deleteObject(doc.fileUrl).catch(() => {});
    }
    await prisma.documentUpload.delete({ where: { id: doc.id } });
    res.json({ message: 'Document deleted' });
  } catch (error) {
    next(error);
  }
}
