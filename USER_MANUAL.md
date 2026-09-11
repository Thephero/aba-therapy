# Therapy Platform — User Guide

A simple guide to using the platform for therapy centers. This guide explains **what the platform does and how to use it** — it contains no internal or technical details.

---

## 1. Getting Started

### Logging in
1. Open the web address you received from your center administrator (for example, the link they shared with you).
2. Enter the **email** and **password** that your center administrator created for you.
3. Click **Sign in**.

> If you forget your password, ask your center administrator to reset it for you.

### Roles on the platform
Your account has one of these roles, and you'll see the parts of the platform that belong to your role:

| Role | What they do |
|------|--------------|
| **Center Admin** | Manages the center: staff accounts, students, programs, and center-wide reports |
| **Supervisor** | Creates programs and targets, sets up behavior plans, assigns therapists, co-signs session notes |
| **Therapist** | Runs sessions, records trial/behavior/mand data, writes session notes |
| **Parent / Guardian** | Views their child's progress, programs, and session summaries only |

---

## 2. The Dashboard

When you sign in, you land on your **Dashboard**. It shows:

- **Quick stats** on the left rail: students, staff, sessions, and trends compared with the previous period (day / week / month).
- **Activity overview** cards: students, staff, sessions run vs. scheduled, completed/in-progress sessions, trials, and behaviors for the selected period.
- **Pending Notes** (for therapists and supervisors): the number of completed sessions that still need a session note written.
- A **Run a Session** button (for therapists and supervisors) to jump straight to starting a session.

Use the **Today / Week / Month** toggle to change the period shown in the stats.

---

## 3. Students

The **Students** page lists all students you can access (therapists and parents only see students assigned to them).

### Adding a student (Admin / Supervisor)
1. Go to **Students** and click **Add Student**.
2. Enter the student's name, date of birth, and guardian contact details.
3. Click **Add Student**.

### Running a Clinical Assessment (Admin / Supervisor)
From a student's profile, push **Start Assessment** (or **Assessments → Start New**):

1. **Setup** — choose the assessment type:
   - **VB-MAPP Grid**: Levels 1–3, scored 0 / 0.5 / 1 per item, 5 items per domain, attempts 1–4 (each attempt gets its own color on the Master Grid).
   - **ABLLS-R Grid**: Domains A–Y, scored 0–4 per task, 5 tracked tasks per domain.
2. **Ready to Start** — conduct the assessment with the learner, then **push Start** when you're ready to enter scores.
3. **Score Entry** — tap a score for every item in each domain. Use **Save Draft** to pause, or **Submit Assessment** to finalize (creating a new attempt replaces an existing draft for the same attempt number).

The results page shows:

- **Evaluation dashboard** — total score, percentage, mastered/deficit item counts, and change vs the previous attempt.
- **Flags** — lack-of-progress and regression flags when scores don't improve between attempts.
- **Master Grid** — color-coded blocks per item (half-height fill = half credit). Hover any block for the item's score.
- **Deficit list** — every item below max score, categorized as DEFICIT (0) or EMERGING (partial).
- **Suggested Goals** — goals from the universal goal bank ranked by deficit severity. Accept, Modify, or Reject each one.
- **Report** — an auto-drafted SOAP-style clinical report (copy or download scores as CSV). All outputs are recommendations; BCBA review and sign-off required.

### Student profile
Click any student card to open their profile. From here you can:

- View and edit guardian information.
- **Assign supervisors and therapists** (Admin / Supervisor) — only assigned staff will be able to see this student's data.
- View **Programs & Targets**.
- Manage **Behavior Plans** (see section 5).
- **Link a Parent Account** (Admin / Supervisor) so a parent can log in and see only their child.

---

## 4. Programs & Targets

Programs are the skill-acquisition areas worked on with a student (e.g., "Color Identification"). Each program contains **targets** — the specific skills being taught (e.g., "Identify Red").

### Creating a program (Admin / Supervisor)
1. Go to **Programs** and click **New Program**.
2. Choose the student, name the program, and add a short description.
3. Click **Create Program**.

### Adding targets (Admin / Supervisor)
1. On the **Programs** page, click **Manage** next to a program.
2. Click **Add Target**.
3. Fill in:
   - **Domain** — the skill area (Communication, Social, Daily Living, etc.).
   - **Skill / Target name** — the specific skill.
   - **Prompt hierarchy** — the prompts used, from most to least help (comma-separated).
   - **Mastery % and consecutive sessions** — how the target is considered mastered.
   - Optional notes.
4. Click **Add Target**.

You can edit any target later with the **Edit** button.

---

## 5. Behavior Plans (Admin / Supervisor)

Behavior plans define how a challenging behavior is measured during sessions, so data is collected consistently.

1. Open a **student profile** and scroll to the **Behavior Plans** card.
2. Click **New Plan**.
3. Give the behavior a name (e.g., "Aggression").
4. Choose the **data type**:
   - **Frequency (count)** — count how many times the behavior happens.
   - **Duration (timer)** — measure how long the behavior lasts with the built-in timer.
5. Optionally add the **ABC options** (antecedent / behavior / consequence) the therapist can pick from during recording.
6. Click **Create Plan**.

When a therapist logs a behavior for this student, they choose the plan and the **data type is fixed by the plan** — so everyone records the same way.

---

## 6. Sessions

### Starting a session (Therapist / Supervisor / Admin)
1. Go to **Sessions** and click **Start Session** (or use the **Run a Session** button on the dashboard).
2. Choose the student.
3. Select the **session modalities** you'll work on — most sessions include several at once (e.g., DTT + NET + group skills). Tick all that apply.
4. Optionally add a location.
5. Click **Start Session**.

You can also schedule sessions in advance with the **Schedule** button (Admin / Supervisor), and start a scheduled session later with the **Begin** button.

### Recording data during a session
While a session is **in progress**, use the buttons at the top:

- **Record Trial** — log a discrete trial: choose a target, outcome (correct/incorrect), the response, and the prompt level used.
- **Log Behavior** — choose a behavior plan (if one exists) or log manually. For frequency, enter a count. For duration, use the **built-in timer** (Start / Stop / Reset). Pick the **antecedent, behavior, and consequence** from the dropdowns (or type your own).
- **Record Mand** — log a request the learner made: type (spontaneous / prompted / echoic), the item requested, prompt level, and whether it was independent.
- **Preference** — record a preference assessment.

### Ending a session
Click **End Session**. You can keep recording data right up until you end it.

> Tip: you don't have to write your notes before ending the session — see the next section.

---

## 7. Session Notes (SOAP)

Session notes summarise what happened in a session.

- Click **SOAP Notes** (or **Write / Edit** on the SOAP card) to write or edit notes **during** the session **and after** it ends — until the note is finalized.
- **Auto-Generate** creates a draft from the session data automatically, including a **per-program breakdown** of trials and accuracy.
- **Generate & Save Draft** creates the draft and saves it.
- A supervisor **co-signs and finalizes** the note to complete the process. Once finalized, it can't be edited.

---

## 8. Reports (Admin / Supervisor)

The **Reports** page shows trends over time:

- **Total Sessions**, **Completed**, and **Active Students** with trend indicators (▲ up / ▼ down vs. the previous period) and mini charts.
- Use the **Today / Week / Month** toggle to change the comparison period.

---

## 9. Calendar (Admin / Supervisor)

The **Calendar** page shows scheduled and past sessions so you can see the week at a glance.

---

## 10. For Parents & Guardians

If you're a parent, when you log in you'll see **only your child's information**:

- **Students** — your child's profile with programs and targets.
- **Sessions** — your child's session history.

Parents have read-only access; only the center's staff can make changes.

---

## 11. Privacy & Access

- Staff see **only the students assigned to them** (therapists see their own caseload; supervisors see the students they oversee).
- Parents see **only their own child**.
- All data is stored securely by your center's platform administrator.

---

## 12. Need help?

- **Account / password issues** → contact your center administrator.
- **Questions about a student's program** → contact the student's supervisor.
- Anything else → your center administrator can help, or share this guide with your team.
