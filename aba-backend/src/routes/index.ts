import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';

// Controllers
import * as authController from '../controllers/authController';
import * as centerController from '../controllers/centerController';
import * as userController from '../controllers/userController';
import * as studentController from '../controllers/studentController';
import * as programController from '../controllers/programController';
import * as sessionController from '../controllers/sessionController';
import * as behaviorPlanController from '../controllers/behaviorPlanController';

import sessionRulesRoutes from './sessionRules';

const router = Router();

// ─── Health Check ───────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Auth Routes ────────────────────────────────────────────────────────────
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/refresh', authController.refresh);
router.post('/auth/logout', authenticate, authController.logout);
router.get('/auth/me', authenticate, authController.me);

// ─── Center Routes ──────────────────────────────────────────────────────────
router.get('/centers', authenticate, authorize('CENTER_ADMIN'), centerController.listCenters);
router.get('/centers/:id', authenticate, centerController.getCenter);
router.patch('/centers/:id', authenticate, authorize('CENTER_ADMIN'), centerController.updateCenter);

// ─── User Routes ────────────────────────────────────────────────────────────
router.get('/users', authenticate, authorize('CENTER_ADMIN', 'SUPERVISOR'), userController.listUsers);
router.post('/users', authenticate, authorize('CENTER_ADMIN'), auditLog('MANAGE_USERS', 'User'), userController.createUser);
router.patch('/users/:id', authenticate, authorize('CENTER_ADMIN'), userController.updateUser);
router.delete('/users/:id', authenticate, authorize('CENTER_ADMIN'), userController.deleteUser);

// ─── Student Routes ─────────────────────────────────────────────────────────
router.get('/students', authenticate, studentController.listStudents);
router.get('/students/:id', authenticate, auditLog('VIEW_PATIENT', 'Student'), studentController.getStudent);
router.post('/students', authenticate, authorize('CENTER_ADMIN', 'SUPERVISOR'), auditLog('CREATE_RECORD', 'Student'), studentController.createStudent);
router.patch('/students/:id', authenticate, authorize('CENTER_ADMIN', 'SUPERVISOR'), studentController.updateStudent);
router.delete('/students/:id', authenticate, authorize('CENTER_ADMIN'), studentController.archiveStudent);

// Student-Supervisor assignments
router.post('/students/:id/supervisors', authenticate, authorize('CENTER_ADMIN', 'SUPERVISOR'), studentController.assignSupervisor);
router.delete('/students/:id/supervisors/:supervisorId', authenticate, authorize('CENTER_ADMIN'), studentController.removeSupervisor);

// Student-Therapist assignments
router.post('/students/:id/therapists', authenticate, authorize('CENTER_ADMIN', 'SUPERVISOR'), studentController.assignTherapist);
router.delete('/students/:id/therapists/:therapistId', authenticate, authorize('CENTER_ADMIN'), studentController.removeTherapist);

// ─── Program Routes ─────────────────────────────────────────────────────────
router.get('/programs', authenticate, programController.listPrograms);
router.get('/programs/:id', authenticate, programController.getProgram);
router.post('/programs', authenticate, authorize('CENTER_ADMIN', 'SUPERVISOR'), programController.createProgram);
router.patch('/programs/:id', authenticate, authorize('CENTER_ADMIN', 'SUPERVISOR'), programController.updateProgram);

// Targets
router.post('/programs/:programId/targets', authenticate, authorize('CENTER_ADMIN', 'SUPERVISOR'), programController.addTarget);
router.patch('/programs/:programId/targets/:targetId', authenticate, authorize('CENTER_ADMIN', 'SUPERVISOR'), programController.updateTarget);

// ─── Behavior Plans ────────────────────────────────────────────────────────
router.get('/students/:studentId/behavior-plans', authenticate, behaviorPlanController.listBehaviorPlans);
router.post('/students/:studentId/behavior-plans', authenticate, authorize('CENTER_ADMIN', 'SUPERVISOR'), behaviorPlanController.createBehaviorPlan);
router.patch('/behavior-plans/:planId', authenticate, authorize('CENTER_ADMIN', 'SUPERVISOR'), behaviorPlanController.updateBehaviorPlan);
router.delete('/behavior-plans/:planId', authenticate, authorize('CENTER_ADMIN', 'SUPERVISOR'), behaviorPlanController.deleteBehaviorPlan);

// ─── Dashboard Summary ─────────────────────────────────────────────────────
router.get('/dashboard/summary', authenticate, sessionController.getDashboardSummary);

// ─── Session Routes ─────────────────────────────────────────────────────────
router.get('/sessions/calendar', authenticate, sessionController.getCalendarSessions);
router.get('/sessions', authenticate, sessionController.listSessions);
router.post('/sessions/start', authenticate, sessionController.startSession);
router.post('/sessions/schedule', authenticate, authorize('CENTER_ADMIN', 'SUPERVISOR'), sessionController.scheduleSession);
router.patch('/sessions/:id/begin', authenticate, sessionController.beginScheduledSession);
router.get('/sessions/:id', authenticate, sessionController.getSession);
router.patch('/sessions/:id/end', authenticate, sessionController.endSession);

// Session Data
router.post('/sessions/:id/trials', authenticate, sessionController.addTrial);
router.post('/sessions/:id/behaviors', authenticate, sessionController.addBehaviorRecord);
router.post('/sessions/:id/mands', authenticate, sessionController.addMandRecord);
router.post('/sessions/:id/preferences', authenticate, sessionController.addPreferenceAssessment);
router.post('/sessions/:id/reinforcers', authenticate, sessionController.addReinforcerCheck);

// SOAP Notes
router.post('/sessions/:id/soap', authenticate, sessionController.saveSOAPNote);
router.post('/sessions/:id/soap/cosign', authenticate, authorize('SUPERVISOR'), sessionController.coSignSOAPNote);

// ─── Staff → Student Assignments ─────────────────────────────────────────
router.get('/users/:id/assignments', authenticate, authorize('CENTER_ADMIN'), userController.getUserStudentAssignments);
router.post('/users/:id/students', authenticate, authorize('CENTER_ADMIN'), userController.assignStudentsToUser);

// ─── Supervisor-Therapist Assignments ─────────────────────────────────────
router.get('/supervisors/therapists', authenticate, userController.getMyTherapists);
router.post('/supervisors/:id/therapists', authenticate, authorize('CENTER_ADMIN'), userController.assignTherapistToSupervisor);
router.delete('/supervisors/:id/therapists/:therapistId', authenticate, authorize('CENTER_ADMIN'), userController.removeTherapistFromSupervisor);

// ─── Rule Engine & SOAP Notes (sessionRules) ────────────────────────────────
router.use(sessionRulesRoutes);

export default router;
