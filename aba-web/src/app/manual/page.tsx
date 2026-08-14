import Link from 'next/link';

const sections = [
  {
    id: 'getting-started',
    title: '1. Getting Started',
    body: (
      <>
        <h3 className="font-semibold text-gray-900">Logging in</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Open the web address you received from your center administrator (the link they shared with you).</li>
          <li>Enter the <strong>email</strong> and <strong>password</strong> that your center administrator created for you.</li>
          <li>Click <strong>Sign in</strong>.</li>
        </ol>
        <p className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          Forgot your password? Ask your center administrator to reset it for you.
        </p>
        <h3 className="mt-5 font-semibold text-gray-900">Roles on the platform</h3>
        <p className="mt-2 text-sm text-gray-600">
          Your account has one of these roles, and you&apos;ll see the parts of the platform that belong to your role:
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="pb-2 font-medium text-gray-500">Role</th>
                <th className="pb-2 font-medium text-gray-500">What they do</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="py-2 pr-4 font-medium text-gray-900">Center Admin</td>
                <td className="py-2 text-gray-600">Manages the center: staff accounts, students, programs, and center-wide reports</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-gray-900">Supervisor</td>
                <td className="py-2 text-gray-600">Creates programs and targets, sets up behavior plans, assigns therapists, co-signs session notes</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-gray-900">Therapist</td>
                <td className="py-2 text-gray-600">Runs sessions, records trial/behavior/mand data, writes session notes</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-gray-900">Parent / Guardian</td>
                <td className="py-2 text-gray-600">Views their child&apos;s progress, programs, and session summaries only</td>
              </tr>
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: 'dashboard',
    title: '2. The Dashboard',
    body: (
      <>
        <p className="text-sm text-gray-600">
          When you sign in, you land on your <strong>Dashboard</strong>. It shows:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li><strong>Quick stats</strong> on the left rail: students, staff, sessions, and trends compared with the previous period (day / week / month).</li>
          <li><strong>Activity overview</strong> cards: students, staff, sessions run vs. scheduled, completed/in-progress sessions, trials, and behaviors for the selected period.</li>
          <li><strong>Pending Notes</strong> (for therapists and supervisors): the number of completed sessions that still need a session note written.</li>
          <li>A <strong>Run a Session</strong> button (for therapists and supervisors) to jump straight to starting a session.</li>
        </ul>
        <p className="mt-3 text-sm text-gray-600">
          Use the <strong>Today / Week / Month</strong> toggle to change the period shown in the stats.
        </p>
      </>
    ),
  },
  {
    id: 'students',
    title: '3. Students',
    body: (
      <>
        <p className="text-sm text-gray-600">
          The <strong>Students</strong> page lists all students you can access (therapists and parents only see students assigned to them).
        </p>
        <h3 className="mt-4 font-semibold text-gray-900">Adding a student (Admin / Supervisor)</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-600">
          <li>Go to <strong>Students</strong> and click <strong>Add Student</strong>.</li>
          <li>Enter the student&apos;s name, date of birth, and guardian contact details.</li>
          <li>Click <strong>Add Student</strong>.</li>
        </ol>
        <h3 className="mt-4 font-semibold text-gray-900">Student profile</h3>
        <p className="mt-2 text-sm text-gray-600">Click any student card to open their profile. From here you can:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>View and edit guardian information.</li>
          <li><strong>Assign supervisors and therapists</strong> (Admin / Supervisor) — only assigned staff will be able to see this student&apos;s data.</li>
          <li>View <strong>Programs &amp; Targets</strong>.</li>
          <li>Manage <strong>Behavior Plans</strong> (see section 5).</li>
          <li><strong>Link a Parent Account</strong> (Admin / Supervisor) so a parent can log in and see only their child.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'programs',
    title: '4. Programs & Targets',
    body: (
      <>
        <p className="text-sm text-gray-600">
          Programs are the skill-acquisition areas worked on with a student (e.g., &ldquo;Color Identification&rdquo;).
          Each program contains <strong>targets</strong> — the specific skills being taught (e.g., &ldquo;Identify Red&rdquo;).
        </p>
        <h3 className="mt-4 font-semibold text-gray-900">Creating a program (Admin / Supervisor)</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-600">
          <li>Go to <strong>Programs</strong> and click <strong>New Program</strong>.</li>
          <li>Choose the student, name the program, and add a short description.</li>
          <li>Click <strong>Create Program</strong>.</li>
        </ol>
        <h3 className="mt-4 font-semibold text-gray-900">Adding targets (Admin / Supervisor)</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-600">
          <li>On the <strong>Programs</strong> page, click <strong>Manage</strong> next to a program.</li>
          <li>Click <strong>Add Target</strong>.</li>
          <li>Fill in: <strong>Domain</strong> (skill area), <strong>Skill / Target name</strong>, <strong>Prompt hierarchy</strong> (comma-separated, most to least help), <strong>Mastery % and consecutive sessions</strong>, and optional notes.</li>
          <li>Click <strong>Add Target</strong>.</li>
        </ol>
        <p className="mt-3 text-sm text-gray-600">You can edit any target later with the <strong>Edit</strong> button.</p>
      </>
    ),
  },
  {
    id: 'behavior-plans',
    title: '5. Behavior Plans (Admin / Supervisor)',
    body: (
      <>
        <p className="text-sm text-gray-600">
          Behavior plans define how a challenging behavior is measured during sessions, so data is collected consistently.
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-600">
          <li>Open a <strong>student profile</strong> and scroll to the <strong>Behavior Plans</strong> card.</li>
          <li>Click <strong>New Plan</strong>.</li>
          <li>Give the behavior a name (e.g., &ldquo;Aggression&rdquo;).</li>
          <li>Choose the <strong>data type</strong>: <strong>Frequency (count)</strong> or <strong>Duration (timer)</strong>.</li>
          <li>Optionally add the <strong>ABC options</strong> (antecedent / behavior / consequence) the therapist can pick from during recording.</li>
          <li>Click <strong>Create Plan</strong>.</li>
        </ol>
        <p className="mt-3 rounded-lg bg-indigo-50 border border-indigo-200 p-3 text-sm text-indigo-800">
          When a therapist logs a behavior for this student, they choose the plan and the <strong>data type is fixed by the plan</strong> — so everyone records the same way.
        </p>
      </>
    ),
  },
  {
    id: 'sessions',
    title: '6. Sessions',
    body: (
      <>
        <h3 className="font-semibold text-gray-900">Starting a session (Therapist / Supervisor / Admin)</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-600">
          <li>Go to <strong>Sessions</strong> and click <strong>Start Session</strong> (or use the <strong>Run a Session</strong> button on the dashboard).</li>
          <li>Choose the student.</li>
          <li>Select the <strong>session modalities</strong> you&apos;ll work on — most sessions include several at once (e.g., DTT + NET + group skills). Tick all that apply.</li>
          <li>Optionally add a location.</li>
          <li>Click <strong>Start Session</strong>.</li>
        </ol>
        <p className="mt-3 text-sm text-gray-600">
          You can also schedule sessions in advance with the <strong>Schedule</strong> button (Admin / Supervisor), and start a scheduled session later with the <strong>Begin</strong> button.
        </p>
        <h3 className="mt-5 font-semibold text-gray-900">Recording data during a session</h3>
        <p className="mt-2 text-sm text-gray-600">While a session is <strong>in progress</strong>, use the buttons at the top:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li><strong>Record Trial</strong> — log a discrete trial: choose a target, outcome (correct/incorrect), the response, and the prompt level used.</li>
          <li><strong>Log Behavior</strong> — choose a behavior plan (if one exists) or log manually. For frequency, enter a count. For duration, use the <strong>built-in timer</strong> (Start / Stop / Reset). Pick the <strong>antecedent, behavior, and consequence</strong> from the dropdowns (or type your own).</li>
          <li><strong>Record Mand</strong> — log a request the learner made: type (spontaneous / prompted / echoic), the item requested, prompt level, and whether it was independent.</li>
          <li><strong>Preference</strong> — record a preference assessment.</li>
        </ul>
        <h3 className="mt-5 font-semibold text-gray-900">Ending a session</h3>
        <p className="mt-2 text-sm text-gray-600">
          Click <strong>End Session</strong>. You can keep recording data right up until you end it.
        </p>
      </>
    ),
  },
  {
    id: 'notes',
    title: '7. Session Notes (SOAP)',
    body: (
      <>
        <p className="text-sm text-gray-600">Session notes summarise what happened in a session.</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>Click <strong>SOAP Notes</strong> (or <strong>Write / Edit</strong> on the SOAP card) to write or edit notes <strong>during</strong> the session <strong>and after</strong> it ends — until the note is finalized.</li>
          <li><strong>Auto-Generate</strong> creates a draft from the session data automatically, including a <strong>per-program breakdown</strong> of trials and accuracy.</li>
          <li><strong>Generate &amp; Save Draft</strong> creates the draft and saves it.</li>
          <li>A supervisor <strong>co-signs and finalizes</strong> the note to complete the process. Once finalized, it can&apos;t be edited.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'reports',
    title: '8. Reports (Admin / Supervisor)',
    body: (
      <>
        <p className="text-sm text-gray-600">The <strong>Reports</strong> page shows trends over time:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li><strong>Total Sessions</strong>, <strong>Completed</strong>, and <strong>Active Students</strong> with trend indicators (▲ up / ▼ down vs. the previous period) and mini charts.</li>
          <li>Use the <strong>Today / Week / Month</strong> toggle to change the comparison period.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'calendar',
    title: '9. Calendar (Admin / Supervisor)',
    body: (
      <p className="text-sm text-gray-600">
        The <strong>Calendar</strong> page shows scheduled and past sessions so you can see the week at a glance.
      </p>
    ),
  },
  {
    id: 'parents',
    title: '10. For Parents & Guardians',
    body: (
      <>
        <p className="text-sm text-gray-600">
          If you&apos;re a parent, when you log in you&apos;ll see <strong>only your child&apos;s information</strong>:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li><strong>Students</strong> — your child&apos;s profile with programs and targets.</li>
          <li><strong>Sessions</strong> — your child&apos;s session history.</li>
        </ul>
        <p className="mt-2 text-sm text-gray-600">Parents have read-only access; only the center&apos;s staff can make changes.</p>
      </>
    ),
  },
  {
    id: 'privacy',
    title: '11. Privacy & Access',
    body: (
      <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
        <li>Staff see <strong>only the students assigned to them</strong> (therapists see their own caseload; supervisors see the students they oversee).</li>
        <li>Parents see <strong>only their own child</strong>.</li>
        <li>All data is stored securely by your center&apos;s platform administrator.</li>
      </ul>
    ),
  },
  {
    id: 'help',
    title: '12. Need help?',
    body: (
      <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
        <li><strong>Account / password issues</strong> → contact your center administrator.</li>
        <li><strong>Questions about a student&apos;s program</strong> → contact the student&apos;s supervisor.</li>
        <li>Anything else → your center administrator can help.</li>
      </ul>
    ),
  },
] as const;

export default function ManualPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-indigo-600">
            <Link href="/login" className="font-medium hover:text-indigo-800 hover:underline">
              ← Back to Sign in
            </Link>
          </div>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">Therapy Platform — User Guide</h1>
          <p className="mt-2 text-gray-600">
            A simple guide to using the platform for therapy centers. It explains <strong>what the platform does and how
            to use it</strong>.
          </p>
        </div>

        {/* Table of contents */}
        <nav className="mb-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Contents</h2>
          <div className="mt-3 grid gap-1 sm:grid-cols-2">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
              >
                {s.title}
              </a>
            ))}
          </div>
        </nav>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((s) => (
            <section
              key={s.id}
              id={s.id}
              className="scroll-mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-xl font-semibold text-gray-900">{s.title}</h2>
              <div className="mt-3">{s.body}</div>
            </section>
          ))}
        </div>

        <footer className="mt-10 border-t border-gray-200 pt-6 text-center text-sm text-gray-400">
          <p>
            Need help? Contact your center administrator. ·{' '}
            <Link href="/login" className="text-indigo-500 hover:text-indigo-700 hover:underline">
              Sign in to the platform
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
