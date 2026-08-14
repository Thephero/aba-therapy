'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft, Clock, User, Target, Activity, Brain, Stethoscope,
  CheckCircle2, XCircle, AlertTriangle, Plus, Play, Square,
  BookOpen, Save, FileText, Sparkles, Users, MessageCircle, Timer,
} from 'lucide-react';
import { formatDateTime, formatStatus } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';

const statusColors: Record<string, 'warning' | 'success' | 'default' | 'danger'> = {
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  DRAFT: 'default',
};

const promptLevels = [
  'Independent',
  'Gestural',
  'Verbal',
  'Modeling',
  'Partial Physical',
  'Full Physical',
];

// Default ABC options when the supervisor hasn't defined custom ones.
const DEFAULT_ANTECEDENTS = ['Task demand', 'Instruction given', 'Attention removed', 'Denied access', 'Transition', 'Alone/Unoccupied', 'Tangible removed'];
const DEFAULT_BEHAVIORS = ['Screaming', 'Hitting', 'Biting', 'Throwing', 'Elopement', 'Hand flapping', 'Crying'];
const DEFAULT_CONSEQUENCES = ['Attention given', 'Demand removed', 'Redirected', 'Ignored', 'Blocked', 'Tangible given', 'Time away'];

export default function SessionDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { user } = useAuth();
  const isSupervisor = user?.role === 'supervisor' || user?.role === 'center_admin';

  const { data, isLoading } = useQuery({
    queryKey: ['session', id],
    queryFn: async () => {
      const { data } = await api.get(`/sessions/${id}`);
      return data.session;
    },
  });

  // ── Supervisor/Therapist assignment ──
  const [showAssignSupervisorModal, setShowAssignSupervisorModal] = useState(false);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [showAssignTherapistModal, setShowAssignTherapistModal] = useState(false);
  const [selectedTherapistId, setSelectedTherapistId] = useState('');

  const { data: supervisorsList } = useQuery({
    queryKey: ['supervisors-for-assignment'],
    queryFn: async () => {
      const { data } = await api.get('/users', { params: { role: 'SUPERVISOR' } });
      return data.users;
    },
    enabled: isSupervisor,
  });

  const { data: therapistsList } = useQuery({
    queryKey: ['therapists-for-assignment'],
    queryFn: async () => {
      const { data } = await api.get('/users', { params: { role: 'THERAPIST' } });
      return data.users;
    },
    enabled: isSupervisor,
  });

  const assignSupervisorMutation = useMutation({
    mutationFn: async (supervisorId: string) => {
      const studentId = data?.student?.id;
      if (!studentId) throw new Error('No student linked to this session');
      await api.post(`/students/${studentId}/supervisors`, { supervisorId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', id] });
      setShowAssignSupervisorModal(false);
      setSelectedSupervisorId('');
      showToast('Supervisor assigned to student', 'success');
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.error || 'Failed to assign supervisor', 'error');
    },
  });

  const assignTherapistMutation = useMutation({
    mutationFn: async (therapistId: string) => {
      const studentId = data?.student?.id;
      if (!studentId) throw new Error('No student linked to this session');
      await api.post(`/students/${studentId}/therapists`, { therapistId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', id] });
      setShowAssignTherapistModal(false);
      setSelectedTherapistId('');
      showToast('Therapist assigned to student', 'success');
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.error || 'Failed to assign therapist', 'error');
    },
  });

  // ── Modals State ──
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [showBehaviorModal, setShowBehaviorModal] = useState(false);
  const [showMandModal, setShowMandModal] = useState(false);
  const [showPreferenceModal, setShowPreferenceModal] = useState(false);
  const [showReinforcerModal, setShowReinforcerModal] = useState(false);
  const [showSOAPModal, setShowSOAPModal] = useState(false);

  // ── Behavior plans for this student ──
  const studentId = data?.student?.id;
  const { data: behaviorPlans } = useQuery({
    queryKey: ['behavior-plans', studentId],
    queryFn: async () => {
      const res = await api.get(`/students/${studentId}/behavior-plans`);
      return res.data.plans;
    },
    enabled: !!studentId,
  });
  const activePlans = (behaviorPlans || []).filter((p: any) => p.isActive);

  // ── Trial Form ──
  const [trialForm, setTrialForm] = useState({
    targetId: '',
    trialNumber: 1,
    response: '',
    correct: true,
    promptLevelUsed: '',
    notes: '',
  });

  const addTrialMutation = useMutation({
    mutationFn: async (form: typeof trialForm) => {
      const { data } = await api.post(`/sessions/${id}/trials`, form);
      return data.trial;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', id] });
      setTrialForm({ targetId: '', trialNumber: (data?.trials?.length || 0) + 2, response: '', correct: true, promptLevelUsed: '', notes: '' });
      setShowTrialModal(false);
      showToast('Trial saved successfully', 'success');
    },
    onError: (error: any) => {
      showToast(error?.response?.data?.error || 'Failed to save trial', 'error');
    },
  });

  // ── Behavior Form ──
  const [behaviorForm, setBehaviorForm] = useState({
    behaviorPlanId: '',
    behaviorType: 'FREQUENCY',
    behaviorName: '',
    antecedent: '',
    antecedentOther: '',
    behavior: '',
    behaviorOther: '',
    consequence: '',
    consequenceOther: '',
    frequency: 1,
    durationSec: 30,
    intensity: 3,
    notes: '',
  });

  // Duration timer: start/stop counts elapsed seconds into durationSec.
  const [timerRunning, setTimerRunning] = useState(false);
  const timerStartRef = useRef<number | null>(null);
  const timerAccumRef = useRef(0);
  const timerTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (timerTickRef.current) clearInterval(timerTickRef.current);
    timerTickRef.current = null;
    if (timerRunning && timerStartRef.current) {
      timerAccumRef.current += Math.floor((Date.now() - timerStartRef.current) / 1000);
    }
    timerStartRef.current = null;
    setTimerRunning(false);
    setBehaviorForm((prev) => ({ ...prev, durationSec: Math.max(timerAccumRef.current, 1) }));
  };

  const resetTimer = () => {
    stopTimer();
    timerAccumRef.current = 0;
    setBehaviorForm((prev) => ({ ...prev, durationSec: 0 }));
  };

  useEffect(() => {
    if (timerRunning) {
      timerStartRef.current = Date.now();
      timerTickRef.current = setInterval(() => {
        if (timerStartRef.current) {
          const elapsed = timerAccumRef.current + Math.floor((Date.now() - timerStartRef.current) / 1000);
          setBehaviorForm((prev) => ({ ...prev, durationSec: elapsed }));
        }
      }, 250);
    }
    return () => { if (timerTickRef.current) clearInterval(timerTickRef.current); };
  }, [timerRunning]);

  const openBehaviorModal = () => {
    // Prefer a supervisor-defined plan when one exists.
    if (activePlans.length > 0) {
      const first = activePlans[0];
      setBehaviorForm({
        behaviorPlanId: first.id,
        behaviorType: first.dataType,
        behaviorName: first.name,
        antecedent: '', antecedentOther: '', behavior: '', behaviorOther: '', consequence: '', consequenceOther: '',
        frequency: 1, durationSec: 0, intensity: 3, notes: '',
      });
    } else {
      setBehaviorForm({ behaviorPlanId: '', behaviorType: 'FREQUENCY', behaviorName: '', antecedent: '', antecedentOther: '', behavior: '', behaviorOther: '', consequence: '', consequenceOther: '', frequency: 1, durationSec: 0, intensity: 3, notes: '' });
    }
    timerAccumRef.current = 0;
    setTimerRunning(false);
    if (timerTickRef.current) clearInterval(timerTickRef.current);
    setShowBehaviorModal(true);
  };

  const addBehaviorMutation = useMutation({
    mutationFn: async (form: typeof behaviorForm) => {
      const { data } = await api.post(`/sessions/${id}/behaviors`, form);
      return data.record;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', id] });
      stopTimer();
      setShowBehaviorModal(false);
      showToast('Behavior logged successfully', 'success');
    },
    onError: (error: any) => {
      showToast(error?.response?.data?.error || 'Failed to log behavior', 'error');
    },
  });

  // ── Mand Form ──
  const [mandForm, setMandForm] = useState({
    mandType: 'SPONTANEOUS',
    itemRequested: '',
    promptLevelUsed: '',
    independent: true,
    notes: '',
  });

  const addMandMutation = useMutation({
    mutationFn: async (form: typeof mandForm) => {
      const { data } = await api.post(`/sessions/${id}/mands`, form);
      return data.record;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', id] });
      setMandForm({ mandType: 'SPONTANEOUS', itemRequested: '', promptLevelUsed: '', independent: true, notes: '' });
      setShowMandModal(false);
      showToast('Mand recorded', 'success');
    },
    onError: (error: any) => {
      showToast(error?.response?.data?.error || 'Failed to record mand', 'error');
    },
  });

  // ── Preference Form ──
  const [preferenceForm, setPreferenceForm] = useState({
    method: '',
    itemsOffered: '',
    selectedItem: '',
    notes: '',
  });

  const addPreferenceMutation = useMutation({
    mutationFn: async (form: typeof preferenceForm) => {
      const { data } = await api.post(`/sessions/${id}/preferences`, {
        ...form,
        itemsOffered: form.itemsOffered.split(',').map((s: string) => s.trim()).filter(Boolean),
      });
      return data.assessment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', id] });
      setPreferenceForm({ method: '', itemsOffered: '', selectedItem: '', notes: '' });
      setShowPreferenceModal(false);
      showToast('Preference assessment saved', 'success');
    },
    onError: (error: any) => {
      showToast(error?.response?.data?.error || 'Failed to save preference assessment', 'error');
    },
  });

  // ── Reinforcer Form ──
  const [reinforcerForm, setReinforcerForm] = useState({
    reinforcerUsed: '',
    effectivenessRating: 3,
    notes: '',
  });

  const addReinforcerMutation = useMutation({
    mutationFn: async (form: typeof reinforcerForm) => {
      const { data } = await api.post(`/sessions/${id}/reinforcers`, form);
      return data.check;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', id] });
      setReinforcerForm({ reinforcerUsed: '', effectivenessRating: 3, notes: '' });
      setShowReinforcerModal(false);
      showToast('Reinforcer check saved', 'success');
    },
    onError: (error: any) => {
      showToast(error?.response?.data?.error || 'Failed to save reinforcer check', 'error');
    },
  });

  // ── SOAP Form ──
  const [soapForm, setSoapForm] = useState({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  });
  const [soapFinalize, setSoapFinalize] = useState(false);

  const saveSOAPMutation = useMutation({
    mutationFn: async (form: typeof soapForm) => {
      const { data } = await api.post(`/sessions/${id}/soap`, { ...form, isFinalized: soapFinalize });
      return data.soapNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', id] });
      setShowSOAPModal(false);
      showToast('SOAP notes saved', 'success');
    },
    onError: (error: any) => {
      showToast(error?.response?.data?.error || 'Failed to save SOAP notes', 'error');
    },
  });

  const generateSOAPMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/sessions/${id}/generate-soap`);
      return data.note;
    },
    onSuccess: (note: any) => {
      setSoapForm({
        subjective: note?.subjective || '',
        objective: note?.objective || '',
        assessment: note?.assessment || '',
        plan: note?.plan || '',
      });
      setShowSOAPModal(true);
      showToast('SOAP note generated', 'success');
    },
    onError: (error: any) => {
      setSoapForm({ subjective: '', objective: '', assessment: '', plan: '' });
      setShowSOAPModal(true);
      showToast(error?.response?.data?.error || 'Generation failed, open for manual entry', 'warning');
    },
  });

  const generateAndSaveSOAPMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/sessions/${id}/save-soap`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', id] });
      showToast('SOAP draft generated and saved', 'success');
    },
    onError: (error: any) => {
      showToast(error?.response?.data?.error || 'Failed to save SOAP draft', 'error');
    },
  });

  // ── Co-sign SOAP ──
  const cosignMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/sessions/${id}/soap/cosign`);
      return data.soapNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', id] });
      showToast('SOAP note co-signed and finalized', 'success');
    },
    onError: (error: any) => {
      showToast(error?.response?.data?.error || 'Failed to co-sign SOAP note', 'error');
    },
  });

  // ── End Session ──
  const endMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/sessions/${id}/end`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', id] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      showToast('Session ended', 'success');
    },
    onError: (error: any) => {
      showToast(error?.response?.data?.error || 'Failed to end session', 'error');
    },
  });

  // ── Open SOAP Modal (pre-fill if editing) ──
  const openSOAPModal = () => {
    if (data?.soapNote) {
      setSoapForm({
        subjective: data.soapNote.subjective || '',
        objective: data.soapNote.objective || '',
        assessment: data.soapNote.assessment || '',
        plan: data.soapNote.plan || '',
      });
      setSoapFinalize(!!data.soapNote.isFinalized);
    } else {
      setSoapForm({ subjective: '', objective: '', assessment: '', plan: '' });
      setSoapFinalize(false);
    }
    setShowSOAPModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-12 text-center text-gray-500">
        Session not found
      </div>
    );
  }

  const lastTrialNumber = data.trials?.length > 0
    ? Math.max(...data.trials.map((t: any) => t.trialNumber))
    : 0;

  // SOAP notes can be written/edited while the session is running AND after it
  // ends — until the note is finalized (co-signed or marked final).
  const canEditSOAP = data.status === 'IN_PROGRESS'
    || (data.status === 'COMPLETED' && !data.soapNote?.isFinalized);

  const duration = data.startedAt && data.endedAt
    ? `${Math.round((new Date(data.endedAt).getTime() - new Date(data.startedAt).getTime()) / 60000)} minutes`
    : data.startedAt
      ? `${Math.round((Date.now() - new Date(data.startedAt).getTime()) / 60000)} minutes (ongoing)`
      : '—';

  const allTargets = data.programs?.flatMap((sp: any) =>
    sp.program?.targets?.map((t: any) => ({ ...t, programName: sp.program.name })) || []
  ) || [];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        href="/dashboard/sessions"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Sessions
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Session with {data.student?.name || 'Unknown Student'}
            </h1>
            <Badge variant={statusColors[data.status] || 'default'} className="text-sm px-3 py-1">
              {formatStatus(data.status)}
            </Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              Therapist: {data.therapist?.name || '—'}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {data.startedAt ? formatDateTime(data.startedAt) : 'Not started'}
            </span>
            <span className="flex items-center gap-1.5">
              <Activity className="h-4 w-4" />
              Duration: {duration}
            </span>
            {(() => {
              let modalities: string[] = [];
              try { modalities = JSON.parse(data.sessionType || '[]'); } catch { modalities = []; }
              if (modalities.length === 0 && data.sessionType && data.sessionType !== '[]') {
                modalities = [data.sessionType]; // legacy single-string value
              }
              return modalities.length > 0 ? (
                <span className="flex items-center gap-1">
                  {modalities.map((m) => (
                    <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>
                  ))}
                </span>
              ) : null;
            })()}
            {data.supervisor && (
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                Supervisor: {data.supervisor.name}
              </span>
            )}
            {isSupervisor && data?.student?.id && (
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                <button onClick={() => setShowAssignSupervisorModal(true)} className="text-indigo-600 hover:text-indigo-800 underline text-xs">
                  Assign Supervisor
                </button>
                <span className="text-gray-300 mx-0.5">|</span>
                <button onClick={() => setShowAssignTherapistModal(true)} className="text-indigo-600 hover:text-indigo-800 underline text-xs">
                  Assign Therapist
                </button>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data.status === 'SCHEDULED' && (
            <Button
              variant="default"
              onClick={() => {
                if (confirm('Begin this scheduled session now?')) {
                  api.patch(`/sessions/${id}/begin`).then(() => {
                    queryClient.invalidateQueries({ queryKey: ['session', id] });
                    showToast('Session started!', 'success');
                  }).catch((err) => {
                    showToast(err?.response?.data?.error || 'Failed to begin', 'error');
                  });
                }
              }}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              Begin Session
            </Button>
          )}
          {data.status === 'IN_PROGRESS' && (
            <>
              <Button onClick={openSOAPModal} variant="outline" className="gap-2">
                <FileText className="h-4 w-4" />
                SOAP Notes
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm('End this session? Make sure all data has been recorded.')) {
                    endMutation.mutate();
                  }
                }}
                disabled={endMutation.isPending}
                className="gap-2"
              >
                <Square className="h-4 w-4" />
                {endMutation.isPending ? 'Ending...' : 'End Session'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Recording Action Buttons */}
      {data.status === 'IN_PROGRESS' && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setTrialForm(prev => ({ ...prev, trialNumber: lastTrialNumber + 1 })); setShowTrialModal(true); }}>
            <Play className="h-3.5 w-3.5" /> Record Trial
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={openBehaviorModal}>
            <AlertTriangle className="h-3.5 w-3.5" /> Log Behavior
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowMandModal(true)}>
            <MessageCircle className="h-3.5 w-3.5" /> Record Mand
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowPreferenceModal(true)}>
            <Brain className="h-3.5 w-3.5" /> Preference
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => generateSOAPMutation.mutate()}>
            <Sparkles className="h-3.5 w-3.5" />
            {generateSOAPMutation.isPending ? 'Generating...' : 'Auto-Generate SOAP'}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 relative" onClick={() => generateAndSaveSOAPMutation.mutate()}>
            {generateAndSaveSOAPMutation.isPending ? 'Generating...' : 'Generate & Save Draft'}
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Program Targets */}
        {data.programs?.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-gray-400" />
                Programs & Targets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.programs.map((sp: any) => (
                  <div key={sp.id} className="rounded-lg border border-gray-200 p-4">
                    <h3 className="font-semibold text-gray-900">{sp.program.name}</h3>
                    {sp.program.targets?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {sp.program.targets.map((target: any) => (
                          <Badge key={target.id} variant="outline" className="text-xs">
                            {target.domain} — {target.skill}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trials */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-gray-400" />
                Trial Data ({data.trials?.length || 0})
              </span>
              {data.status === 'IN_PROGRESS' && (
                <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={() => { setTrialForm(prev => ({ ...prev, trialNumber: lastTrialNumber + 1 })); setShowTrialModal(true); }}>
                  <Plus className="h-3 w-3" /> Add
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.trials?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="pb-2 font-medium text-gray-500">#</th>
                      <th className="pb-2 font-medium text-gray-500">Response</th>
                      <th className="pb-2 font-medium text-gray-500">Correct</th>
                      <th className="pb-2 font-medium text-gray-500">Prompt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.trials.slice(0, 20).map((trial: any) => (
                      <tr key={trial.id} className="hover:bg-gray-50">
                        <td className="py-2 pr-3 text-gray-500">{trial.trialNumber}</td>
                        <td className="py-2 pr-3 text-gray-700 max-w-[160px] truncate" title={trial.response}>
                          {trial.response || <span className="text-gray-300 italic">—</span>}
                        </td>
                        <td className="py-2 pr-3">
                          {trial.correct ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </td>
                        <td className="py-2 text-gray-500">{trial.promptLevelUsed || '—'}</td>
                      </tr>
                    ))}
                    {data.trials.length > 20 && (
                      <tr>
                        <td colSpan={4} className="py-2 text-center text-gray-400 text-xs">
                          + {data.trials.length - 20} more trials
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    {data.trials.filter((t: any) => t.correct).length} correct
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-red-500" />
                    {data.trials.filter((t: any) => !t.correct).length} incorrect
                  </span>
                  <span className="font-medium text-gray-700">
                    {data.trials.length > 0
                      ? `${Math.round((data.trials.filter((t: any) => t.correct).length / data.trials.length) * 100)}% accuracy`
                      : ''}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-gray-400">
                No trial data recorded yet
                {data.status === 'IN_PROGRESS' && (
                  <div className="mt-2">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => { setTrialForm(prev => ({ ...prev, trialNumber: 1 })); setShowTrialModal(true); }}>
                      <Play className="h-3 w-3" /> Record First Trial
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Behavior Records */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-gray-400" />
                Behaviors ({data.behaviorRecords?.length || 0})
              </span>
              {data.status === 'IN_PROGRESS' && (
                <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={openBehaviorModal}>
                  <Plus className="h-3 w-3" /> Log
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.behaviorRecords?.length > 0 ? (
              <div className="space-y-2">
                {data.behaviorRecords.slice(0, 10).map((record: any) => (
                  <div key={record.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{record.behaviorName}</span>
                      <Badge variant={record.behaviorType === 'FREQUENCY' ? 'warning' : 'primary'} className="text-[10px]">
                        {record.behaviorType}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {record.frequency && <span>×{record.frequency} </span>}
                      {record.durationSec && <span>{record.durationSec}s </span>}
                      {record.intensity && <span>— Intensity: {record.intensity}/5</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-gray-400">
                No behavior records
                {data.status === 'IN_PROGRESS' && (
                  <div className="mt-2">
                    <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={openBehaviorModal}>
                      <Plus className="h-3 w-3" /> Log First Behavior
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mand Records */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-gray-400" />
                Mands ({data.mandRecords?.length || 0})
              </span>
              {data.status === 'IN_PROGRESS' && (
                <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={() => setShowMandModal(true)}>
                  <Plus className="h-3 w-3" /> Add
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.mandRecords?.length > 0 ? (
              <div className="space-y-2">
                {data.mandRecords.slice(0, 10).map((record: any) => (
                  <div key={record.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">
                        {record.itemRequested || 'Mand'}
                      </span>
                      <Badge variant={record.independent ? 'success' : 'warning'} className="text-[10px]">
                        {record.independent ? 'Independent' : 'Prompted'}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {record.mandType && <span>{record.mandType} </span>}
                      {record.promptLevelUsed && <span>· {record.promptLevelUsed}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-gray-400">
                No mands recorded
                {data.status === 'IN_PROGRESS' && (
                  <div className="mt-2">
                    <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => setShowMandModal(true)}>
                      <Plus className="h-3 w-3" /> Record First Mand
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preference Assessments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-gray-400" />
                Preference Assessments ({data.preferenceAssessments?.length || 0})
              </span>
              {data.status === 'IN_PROGRESS' && (
                <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={() => setShowPreferenceModal(true)}>
                  <Plus className="h-3 w-3" /> Add
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.preferenceAssessments?.length > 0 ? (
              <div className="space-y-2">
                {data.preferenceAssessments.map((pa: any) => (
                  <div key={pa.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                    <div className="font-medium text-gray-900">{pa.method}</div>
                    <div className="mt-1 text-gray-500">
                      Selected: <span className="font-medium text-gray-700">{pa.selectedItem || '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-gray-400">
                No preference assessments yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* SOAP Notes */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-gray-400" />
                SOAP Notes
              </span>
              <div className="flex items-center gap-2">
                {data.soapNote?.isFinalized && (
                  <Badge variant="success" className="text-xs">Finalized</Badge>
                )}
                {canEditSOAP && (
                  <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={openSOAPModal}>
                    <BookOpen className="h-3 w-3" /> {data.soapNote ? 'Edit' : 'Write'}
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.soapNote?.subjective || data.soapNote?.objective || data.soapNote?.assessment || data.soapNote?.plan ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {data.soapNote.subjective && (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Subjective</h4>
                    <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{data.soapNote.subjective}</p>
                  </div>
                )}
                {data.soapNote.objective && (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Objective</h4>
                    <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{data.soapNote.objective}</p>
                  </div>
                )}
                {data.soapNote.assessment && (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assessment</h4>
                    <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{data.soapNote.assessment}</p>
                  </div>
                )}
                {data.soapNote.plan && (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Plan</h4>
                    <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{data.soapNote.plan}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-gray-400">
                No SOAP notes yet
                {canEditSOAP && (
                  <div className="mt-2">
                    <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={openSOAPModal}>
                      <Plus className="h-3 w-3" /> Write SOAP Notes
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1 text-xs ml-2" onClick={() => generateSOAPMutation.mutate()}>
                      <Sparkles className="h-3 w-3" />
                      {generateSOAPMutation.isPending ? 'Generating...' : 'Auto-Generate'}
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1 text-xs ml-1" onClick={() => generateAndSaveSOAPMutation.mutate()}>
                      {generateAndSaveSOAPMutation.isPending ? 'Saving...' : 'Save Draft'}
                    </Button>
                  </div>
                )}
              </div>
            )}
            {/* Co-sign info & button */}
            {data.soapNote?.coSignedBy ? (
              <div className="mt-3 text-xs text-gray-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                Co-signed by {data.soapNote.coSignedBy.name || 'Supervisor'}
                {data.soapNote.coSignedAt && ` on ${formatDateTime(data.soapNote.coSignedAt)}`}
              </div>
            ) : (
              data.soapNote && isSupervisor && !data.soapNote.isFinalized && (
                <div className="mt-4 flex items-center gap-2 pt-3 border-t border-gray-100">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      if (confirm('Co-sign and finalize this SOAP note? This action cannot be undone.')) {
                        cosignMutation.mutate();
                      }
                    }}
                    disabled={cosignMutation.isPending || !data.soapNote?.subjective}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {cosignMutation.isPending ? 'Signing...' : 'Co-sign & Finalize SOAP'}
                  </Button>
                  {!data.soapNote?.subjective && (
                    <span className="text-xs text-amber-600">Write SOAP notes first</span>
                  )}
                </div>
              )
            )}
          </CardContent>
        </Card>

        {/* Alerts */}
        {data.alerts?.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Alerts ({data.alerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.alerts.map((alert: any) => (
                  <div key={alert.id} className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">{alert.type}</p>
                      {alert.message && <p className="text-xs text-amber-700 mt-0.5">{alert.message}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ════════════════════════ MODALS ════════════════════════ */}

      {/* ── Add Trial Modal ── */}
      <Modal open={showTrialModal} onClose={() => setShowTrialModal(false)} title="Record Trial" size="lg">
        <div className="space-y-4">
          {/* Target */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target (optional)</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={trialForm.targetId}
              onChange={(e) => setTrialForm({ ...trialForm, targetId: e.target.value })}
            >
              <option value="">— No specific target —</option>
              {allTargets.map((target: any) => (
                <option key={target.id} value={target.id}>
                  {target.programName} — {target.skill} ({target.domain})
                </option>
              ))}
            </select>
          </div>

          {/* Trial Number & Correct */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trial #</label>
              <Input
                type="number"
                min={1}
                value={trialForm.trialNumber}
                onChange={(e) => setTrialForm({ ...trialForm, trialNumber: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Outcome</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTrialForm({ ...trialForm, correct: true })}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    trialForm.correct
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" /> Correct
                </button>
                <button
                  type="button"
                  onClick={() => setTrialForm({ ...trialForm, correct: false })}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    !trialForm.correct
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <XCircle className="h-4 w-4" /> Incorrect
                </button>
              </div>
            </div>
          </div>

          {/* Response */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Response</label>
            <Input
              placeholder="Describe the learner's response..."
              value={trialForm.response}
              onChange={(e) => setTrialForm({ ...trialForm, response: e.target.value })}
            />
          </div>

          {/* Prompt Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prompt Level Used</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={trialForm.promptLevelUsed}
              onChange={(e) => setTrialForm({ ...trialForm, promptLevelUsed: e.target.value })}
            >
              <option value="">— No prompt —</option>
              {promptLevels.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[60px]"
              placeholder="Any additional notes..."
              value={trialForm.notes}
              onChange={(e) => setTrialForm({ ...trialForm, notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowTrialModal(false)}>Cancel</Button>
            <Button onClick={() => addTrialMutation.mutate(trialForm)} disabled={addTrialMutation.isPending}>
              {addTrialMutation.isPending ? 'Saving...' : 'Save Trial'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Add Behavior Record Modal ── */}
      <Modal open={showBehaviorModal} onClose={() => { stopTimer(); setShowBehaviorModal(false); }} title="Log Behavior" size="lg">
        <div className="space-y-4">
          {activePlans.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Behavior Plan</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={behaviorForm.behaviorPlanId}
                onChange={(e) => {
                  const plan = activePlans.find((p: any) => p.id === e.target.value);
                  stopTimer();
                  if (plan) {
                    setBehaviorForm((prev) => ({
                      ...prev,
                      behaviorPlanId: plan.id,
                      behaviorType: plan.dataType,
                      behaviorName: plan.name,
                      durationSec: 0,
                    }));
                  } else {
                    setBehaviorForm((prev) => ({ ...prev, behaviorPlanId: '' }));
                  }
                }}
              >
                <option value="">— No plan (log manually) —</option>
                {activePlans.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.dataType === 'FREQUENCY' ? 'Frequency' : 'Duration'})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">
                When a plan is chosen, the data type is set by the supervisor.
              </p>
            </div>
          )}

          {!behaviorForm.behaviorPlanId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Behavior Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBehaviorForm({ ...behaviorForm, behaviorType: 'FREQUENCY' })}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    behaviorForm.behaviorType === 'FREQUENCY'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Activity className="h-4 w-4" /> Frequency (count)
                </button>
                <button
                  type="button"
                  onClick={() => setBehaviorForm({ ...behaviorForm, behaviorType: 'DURATION' })}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    behaviorForm.behaviorType === 'DURATION'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Clock className="h-4 w-4" /> Duration (time)
                </button>
              </div>
            </div>
          )}

          {/* Behavior Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Behavior Name {!behaviorForm.behaviorPlanId && '*'}</label>
            <Input
              placeholder="e.g., Hand flapping, Aggression, Elopement..."
              value={behaviorForm.behaviorName}
              onChange={(e) => setBehaviorForm({ ...behaviorForm, behaviorName: e.target.value })}
              disabled={!!behaviorForm.behaviorPlanId}
            />
          </div>

          {/* Antecedent, Behavior, Consequence (ABC) dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Antecedent</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={behaviorForm.antecedent}
                onChange={(e) => setBehaviorForm({ ...behaviorForm, antecedent: e.target.value })}
              >
                <option value="">— Select or type —</option>
                {(activePlans.find((p: any) => p.id === behaviorForm.behaviorPlanId)?.abcOptions?.antecedents || DEFAULT_ANTECEDENTS).map((opt: string) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
                <option value="__other">Other (type below)</option>
              </select>
              {behaviorForm.antecedent === '__other' && (
                <Input
                  className="mt-1"
                  placeholder="Describe the antecedent..."
                  value={behaviorForm.antecedentOther}
                  onChange={(e) => setBehaviorForm({ ...behaviorForm, antecedentOther: e.target.value })}
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Behavior</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={behaviorForm.behavior}
                onChange={(e) => setBehaviorForm({ ...behaviorForm, behavior: e.target.value })}
              >
                <option value="">— Select or type —</option>
                {(activePlans.find((p: any) => p.id === behaviorForm.behaviorPlanId)?.abcOptions?.behaviors || DEFAULT_BEHAVIORS).map((opt: string) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
                <option value="__other">Other (type below)</option>
              </select>
              {behaviorForm.behavior === '__other' && (
                <Input
                  className="mt-1"
                  placeholder="Describe the behavior..."
                  value={behaviorForm.behaviorOther}
                  onChange={(e) => setBehaviorForm({ ...behaviorForm, behaviorOther: e.target.value })}
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Consequence</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={behaviorForm.consequence}
                onChange={(e) => setBehaviorForm({ ...behaviorForm, consequence: e.target.value })}
              >
                <option value="">— Select or type —</option>
                {(activePlans.find((p: any) => p.id === behaviorForm.behaviorPlanId)?.abcOptions?.consequences || DEFAULT_CONSEQUENCES).map((opt: string) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
                <option value="__other">Other (type below)</option>
              </select>
              {behaviorForm.consequence === '__other' && (
                <Input
                  className="mt-1"
                  placeholder="Describe the consequence..."
                  value={behaviorForm.consequenceOther}
                  onChange={(e) => setBehaviorForm({ ...behaviorForm, consequenceOther: e.target.value })}
                />
              )}
            </div>
          </div>

          {/* Frequency or Duration (with built-in timer) */}
          {behaviorForm.behaviorType === 'FREQUENCY' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency (count)</label>
              <Input
                type="number"
                min={1}
                value={behaviorForm.frequency}
                onChange={(e) => setBehaviorForm({ ...behaviorForm, frequency: parseInt(e.target.value) || 1 })}
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    type="number"
                    min={0}
                    value={behaviorForm.durationSec}
                    onChange={(e) => setBehaviorForm({ ...behaviorForm, durationSec: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <Button
                  type="button"
                  variant={timerRunning ? 'destructive' : 'default'}
                  onClick={() => setTimerRunning((r) => !r)}
                  className="gap-1.5 whitespace-nowrap"
                >
                  <Timer className="h-4 w-4" />
                  {timerRunning ? 'Stop' : 'Start Timer'}
                </Button>
                <Button type="button" variant="outline" onClick={resetTimer} className="whitespace-nowrap">
                  Reset
                </Button>
              </div>
              <p className="mt-1 text-xs text-gray-400">Seconds — use the built-in timer instead of a watch.</p>
            </div>
          )}

          {/* Intensity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Intensity (1-5)</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setBehaviorForm({ ...behaviorForm, intensity: n })}
                  className={`w-10 h-10 rounded-lg text-sm font-medium border transition-colors ${
                    behaviorForm.intensity === n
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[60px]"
              placeholder="Any additional notes..."
              value={behaviorForm.notes}
              onChange={(e) => setBehaviorForm({ ...behaviorForm, notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowBehaviorModal(false)}>Cancel</Button>
            <Button
              onClick={() => addBehaviorMutation.mutate({
                ...behaviorForm,
                antecedent: behaviorForm.antecedent === '__other' ? behaviorForm.antecedentOther : behaviorForm.antecedent,
                behavior: behaviorForm.behavior === '__other' ? behaviorForm.behaviorOther : behaviorForm.behavior,
                consequence: behaviorForm.consequence === '__other' ? behaviorForm.consequenceOther : behaviorForm.consequence,
              })}
              disabled={addBehaviorMutation.isPending}
            >
              {addBehaviorMutation.isPending ? 'Saving...' : 'Save Behavior'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Add Mand Record Modal ── */}
      <Modal open={showMandModal} onClose={() => setShowMandModal(false)} title="Record Mand" description="Log a request (mand) made by the learner" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mand Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMandForm({ ...mandForm, mandType: 'SPONTANEOUS' })}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  mandForm.mandType === 'SPONTANEOUS'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Sparkles className="h-4 w-4" /> Spontaneous
              </button>
              <button
                type="button"
                onClick={() => setMandForm({ ...mandForm, mandType: 'PROMPTED' })}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  mandForm.mandType === 'PROMPTED'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <AlertTriangle className="h-4 w-4" /> Prompted
              </button>
              <button
                type="button"
                onClick={() => setMandForm({ ...mandForm, mandType: 'ECHOIC' })}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  mandForm.mandType === 'ECHOIC'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <MessageCircle className="h-4 w-4" /> Echoic
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item / Request *</label>
            <Input
              placeholder="e.g., bubbles, water, swing, 'I want iPad'"
              value={mandForm.itemRequested}
              onChange={(e) => setMandForm({ ...mandForm, itemRequested: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prompt Level</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={mandForm.promptLevelUsed}
                onChange={(e) => setMandForm({ ...mandForm, promptLevelUsed: e.target.value })}
              >
                <option value="">— None / Independent —</option>
                {promptLevels.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Outcome</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMandForm({ ...mandForm, independent: true })}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    mandForm.independent
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" /> Independent
                </button>
                <button
                  type="button"
                  onClick={() => setMandForm({ ...mandForm, independent: false })}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    !mandForm.independent
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <XCircle className="h-4 w-4" /> Prompted
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[60px]"
              placeholder="Any additional notes..."
              value={mandForm.notes}
              onChange={(e) => setMandForm({ ...mandForm, notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowMandModal(false)}>Cancel</Button>
            <Button onClick={() => addMandMutation.mutate(mandForm)} disabled={addMandMutation.isPending || !mandForm.itemRequested.trim()}>
              {addMandMutation.isPending ? 'Saving...' : 'Save Mand'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Add Preference Assessment Modal ── */}
      <Modal open={showPreferenceModal} onClose={() => setShowPreferenceModal(false)} title="Preference Assessment" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={preferenceForm.method}
              onChange={(e) => setPreferenceForm({ ...preferenceForm, method: e.target.value })}
            >
              <option value="">Select method...</option>
              <option value="Single Stimulus">Single Stimulus</option>
              <option value="Paired Choice">Paired Choice</option>
              <option value="Multiple Stimulus">Multiple Stimulus</option>
              <option value="Free Operant">Free Operant</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Items Offered</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[60px]"
              placeholder="Enter items separated by commas&#10;e.g., bubbles, train, book, puzzle"
              value={preferenceForm.itemsOffered}
              onChange={(e) => setPreferenceForm({ ...preferenceForm, itemsOffered: e.target.value })}
            />
            <p className="mt-1 text-xs text-gray-400">Separate items with commas</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Selected Item</label>
            <Input
              placeholder="Which item was selected?"
              value={preferenceForm.selectedItem}
              onChange={(e) => setPreferenceForm({ ...preferenceForm, selectedItem: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[60px]"
              placeholder="Any additional observations..."
              value={preferenceForm.notes}
              onChange={(e) => setPreferenceForm({ ...preferenceForm, notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowPreferenceModal(false)}>Cancel</Button>
            <Button onClick={() => addPreferenceMutation.mutate(preferenceForm)} disabled={addPreferenceMutation.isPending}>
              {addPreferenceMutation.isPending ? 'Saving...' : 'Save Assessment'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Add Reinforcer Check Modal ── */}
      <Modal open={showReinforcerModal} onClose={() => setShowReinforcerModal(false)} title="Reinforcer Check" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reinforcer Used</label>
            <Input
              placeholder="e.g., Bubbles, iPad time, sticker..."
              value={reinforcerForm.reinforcerUsed}
              onChange={(e) => setReinforcerForm({ ...reinforcerForm, reinforcerUsed: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Effectiveness Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setReinforcerForm({ ...reinforcerForm, effectivenessRating: n })}
                  className={`flex-1 flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    reinforcerForm.effectivenessRating === n
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Not effective</span>
              <span>Very effective</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[60px]"
              placeholder="Notes about the reinforcer check..."
              value={reinforcerForm.notes}
              onChange={(e) => setReinforcerForm({ ...reinforcerForm, notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowReinforcerModal(false)}>Cancel</Button>
            <Button onClick={() => addReinforcerMutation.mutate(reinforcerForm)} disabled={addReinforcerMutation.isPending}>
              {addReinforcerMutation.isPending ? 'Saving...' : 'Save Check'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── SOAP Notes Editor Modal ── */}
      <Modal
        open={showSOAPModal}
        onClose={() => setShowSOAPModal(false)}
        title={data.soapNote ? 'Edit SOAP Notes' : 'Write SOAP Notes'}
        description="Document the session using the SOAP format"
        size="xl"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subjective</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[80px]"
              placeholder="Client's reported experience, parent/caregiver input, etc."
              value={soapForm.subjective}
              onChange={(e) => setSoapForm({ ...soapForm, subjective: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Objective</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[80px]"
              placeholder="Observable data: trial results, behaviors observed, session activities..."
              value={soapForm.objective}
              onChange={(e) => setSoapForm({ ...soapForm, objective: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assessment</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[80px]"
              placeholder="Clinical analysis, progress notes, patterns observed..."
              value={soapForm.assessment}
              onChange={(e) => setSoapForm({ ...soapForm, assessment: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[80px]"
              placeholder="Next steps, adjustments to program, follow-up needed..."
              value={soapForm.plan}
              onChange={(e) => setSoapForm({ ...soapForm, plan: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="soapFinalize"
              checked={soapFinalize}
              onChange={(e) => setSoapFinalize(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="soapFinalize" className="text-sm text-gray-700">
              Finalize SOAP note (no further edits allowed)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowSOAPModal(false)}>Cancel</Button>
            <Button
              onClick={() => saveSOAPMutation.mutate(soapForm)}
              disabled={saveSOAPMutation.isPending}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {saveSOAPMutation.isPending ? 'Saving...' : 'Save SOAP Notes'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Assign Supervisor Modal ── */}
      <Modal
        open={showAssignSupervisorModal}
        onClose={() => setShowAssignSupervisorModal(false)}
        title="Assign Supervisor"
        description={`Assign a supervisor to ${data.student?.name || 'this student'}`}
        size="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (selectedSupervisorId) {
              assignSupervisorMutation.mutate(selectedSupervisorId);
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Supervisor *</label>
            <select
              value={selectedSupervisorId}
              onChange={(e) => setSelectedSupervisorId(e.target.value)}
              required
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
            >
              <option value="">Choose a supervisor...</option>
              {supervisorsList?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowAssignSupervisorModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={assignSupervisorMutation.isPending || !selectedSupervisorId}>
              {assignSupervisorMutation.isPending ? 'Assigning...' : 'Assign Supervisor'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Assign Therapist Modal ── */}
      <Modal
        open={showAssignTherapistModal}
        onClose={() => setShowAssignTherapistModal(false)}
        title="Assign Therapist"
        description={`Assign a therapist to ${data.student?.name || 'this student'}`}
        size="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (selectedTherapistId) {
              assignTherapistMutation.mutate(selectedTherapistId);
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Therapist *</label>
            <select
              value={selectedTherapistId}
              onChange={(e) => setSelectedTherapistId(e.target.value)}
              required
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
            >
              <option value="">Choose a therapist...</option>
              {therapistsList?.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowAssignTherapistModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={assignTherapistMutation.isPending || !selectedTherapistId}>
              {assignTherapistMutation.isPending ? 'Assigning...' : 'Assign Therapist'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
