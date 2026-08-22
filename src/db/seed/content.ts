import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { drillVersions, drills, programVersions, programs } from '@/db/schema';
import { Rng } from './rng';

/**
 * ספריית תוכן האימון — פרק 5.3 בתוכנית.
 * Single Stroke / Combination / Custom Drill / Program, בשלוש רמות.
 *
 * ⚠ כל תוכנית נשמרת כגרסה (program_versions). סשן מצביע על גרסה,
 * כך ששינוי בתוכנית שפורסמה לא משנה היסטוריית סשנים ישנים.
 */
const DRILL_BLUEPRINTS = [
  { slug: 'bandeja-basic', name: 'בנדחה — יסודות', type: 'single_stroke', level: '1', goal: 'שליטה בבנדחה מגובה בינוני', speed: 45, height: 3, spin: 2, depth: 3, freq: 12, minutes: 20 },
  { slug: 'volley-reflex', name: 'וולה — זמן תגובה', type: 'single_stroke', level: '2', goal: 'קיצור זמן תגובה בוולה', speed: 62, height: 2, spin: 1, depth: 2, freq: 20, minutes: 15 },
  { slug: 'vibora-power', name: 'ויבורה — עוצמה', type: 'single_stroke', level: '3', goal: 'ויבורה מדויקת בעוצמה גבוהה', speed: 78, height: 4, spin: 4, depth: 4, freq: 10, minutes: 25 },
  { slug: 'back-glass-control', name: 'קיר אחורי — שליטה', type: 'single_stroke', level: '2', goal: 'יציאה נכונה מהקיר האחורי', speed: 58, height: 3, spin: 2, depth: 5, freq: 11, minutes: 20 },
  { slug: 'return-consistency', name: 'החזרת הגשה — עקביות', type: 'single_stroke', level: '1', goal: 'החזרה עקבית לעומק', speed: 50, height: 3, spin: 1, depth: 4, freq: 14, minutes: 20 },
  { slug: 'combo-bandeja-volley', name: 'בנדחה → וולה', type: 'combination', level: '2', goal: 'מעבר מהיר מהגנה להתקפה', speed: 55, height: 3, spin: 2, depth: 3, freq: 14, minutes: 25 },
  { slug: 'combo-lob-smash', name: 'לוב → סמאש', type: 'combination', level: '3', goal: 'סגירת נקודה אחרי לוב', speed: 70, height: 5, spin: 3, depth: 4, freq: 9, minutes: 25 },
  { slug: 'quick-start-warmup', name: 'Quick Start — חימום 10 דקות', type: 'quick_start', level: '1', goal: 'חימום מהיר לפני משחק', speed: 42, height: 3, spin: 1, depth: 3, freq: 10, minutes: 10 },
  { slug: 'challenge-30-in-a-row', name: 'אתגר — 30 החזרות רצופות', type: 'challenge', level: '2', goal: 'עקביות תחת לחץ', speed: 55, height: 3, spin: 2, depth: 3, freq: 15, minutes: 15 },
  { slug: 'custom-defense-drill', name: 'תרגיל הגנה מותאם', type: 'custom_drill', level: '3', goal: 'הגנה מול לחץ רשת', speed: 68, height: 2, spin: 3, depth: 5, freq: 16, minutes: 30 },
] as const;

const PROGRAM_BLUEPRINTS = [
  {
    slug: 'foundation-level-1',
    name: 'תוכנית יסוד · רמה 1',
    level: '1' as const,
    goal: 'בניית יסודות: החזרה, בנדחה וקיר אחורי',
    minutes: 45,
    drills: ['return-consistency', 'bandeja-basic', 'back-glass-control'],
  },
  {
    slug: 'progress-level-2',
    name: 'תוכנית התקדמות · רמה 2',
    level: '2' as const,
    goal: 'מעברים בין הגנה להתקפה',
    minutes: 50,
    drills: ['volley-reflex', 'combo-bandeja-volley', 'back-glass-control'],
  },
  {
    slug: 'performance-level-3',
    name: 'תוכנית ביצועים · רמה 3',
    level: '3' as const,
    goal: 'עוצמה, דיוק וסגירת נקודות',
    minutes: 60,
    drills: ['vibora-power', 'combo-lob-smash', 'custom-defense-drill'],
  },
  {
    slug: 'offpeak-express',
    name: 'אקספרס Off-Peak · 30 דקות',
    level: '1' as const,
    goal: 'אימון קצר ויעיל בשעות שפל',
    minutes: 30,
    drills: ['quick-start-warmup', 'return-consistency'],
  },
];

export async function seedContent(rng: Rng, now: Date, coachIds: string[], staffId: string) {
  console.log('▸ תוכן ותוכניות אימון...');

  const drillVersionBySlug = new Map<string, string>();

  for (const d of DRILL_BLUEPRINTS) {
    const [drill] = await db
      .insert(drills)
      .values({
        slug: d.slug,
        nameHe: d.name,
        drillType: d.type,
        createdByCoachId: coachIds.length > 0 ? rng.pick(coachIds) : null,
        createdByUserId: staffId,
        isDemo: true,
      })
      .returning({ id: drills.id });
    if (!drill) continue;

    const [version] = await db
      .insert(drillVersions)
      .values({
        drillId: drill.id,
        versionNumber: 1,
        status: 'published',
        description: `${d.goal}. מכות בקצב ${d.freq} לדקה.`,
        level: d.level,
        trainingGoal: d.goal,
        playerCount: 1,
        durationMinutes: d.minutes,
        shotCount: d.freq * d.minutes,
        speedKmh: d.speed,
        heightLevel: d.height,
        spinLevel: d.spin,
        depthLevel: d.depth,
        angleDegrees: rng.int(-25, 25),
        frequencyPerMinute: d.freq,
        sequence: d.type === 'combination' ? 'random' : 'fixed',
        safetyInstructions:
          'ודא שאזור הבטיחות פנוי לפני ההפעלה. כפתור עצירת חירום נגיש בכל רגע.',
        publishedAt: new Date(now.getTime() - rng.int(30, 150) * 86400000),
        publishedBy: staffId,
        usageCount: rng.int(20, 400),
        completionRate: String(rng.float(0.62, 0.95, 4)),
        avgRating: String(rng.float(3.8, 4.9, 2)),
        isDemo: true,
      })
      .returning({ id: drillVersions.id });
    if (!version) continue;

    drillVersionBySlug.set(d.slug, version.id);
    await db.update(drills).set({ currentVersionId: version.id }).where(eq(drills.id, drill.id));
  }

  const programVersionIds: string[] = [];

  for (const p of PROGRAM_BLUEPRINTS) {
    const [program] = await db
      .insert(programs)
      .values({
        slug: p.slug,
        nameHe: p.name,
        createdByCoachId: coachIds.length > 0 ? rng.pick(coachIds) : null,
        createdByUserId: staffId,
        isDemo: true,
      })
      .returning({ id: programs.id });
    if (!program) continue;

    const [version] = await db
      .insert(programVersions)
      .values({
        programId: program.id,
        versionNumber: 1,
        status: 'published',
        description: p.goal,
        level: p.level,
        trainingGoal: p.goal,
        playerCount: 1,
        durationMinutes: p.minutes,
        drillVersionIds: p.drills
          .map((slug) => drillVersionBySlug.get(slug))
          .filter((id): id is string => Boolean(id)),
        safetyInstructions: 'ודא שאזור הבטיחות פנוי. עצירת חירום נגישה.',
        isCertified: true,
        publishedAt: new Date(now.getTime() - rng.int(40, 160) * 86400000),
        publishedBy: staffId,
        usageCount: rng.int(60, 500),
        completionRate: String(rng.float(0.6, 0.92, 4)),
        avgRating: String(rng.float(4.0, 4.9, 2)),
        isDemo: true,
      })
      .returning({ id: programVersions.id });
    if (!version) continue;

    programVersionIds.push(version.id);
    await db
      .update(programs)
      .set({ currentVersionId: version.id })
      .where(eq(programs.id, program.id));
  }

  // תוכנית אחת בטיוטה ואחת בבדיקה — כדי שמסך התוכן יראה את כל המצבים
  const [draftProgram] = await db
    .insert(programs)
    .values({
      slug: 'winter-doubles-2026',
      nameHe: 'תוכנית זוגות חורף 2026',
      createdByCoachId: coachIds.length > 0 ? coachIds[0]! : null,
      createdByUserId: staffId,
      isDemo: true,
    })
    .returning({ id: programs.id });

  if (draftProgram) {
    await db.insert(programVersions).values([
      {
        programId: draftProgram.id,
        versionNumber: 1,
        status: 'review',
        description: 'תוכנית ייעודית לזוגות. ממתינה לאישור תוכן.',
        level: '2',
        trainingGoal: 'תיאום בין שני שחקנים',
        playerCount: 2,
        durationMinutes: 45,
        drillVersionIds: [],
        isDemo: true,
      },
    ]);
  }

  console.log(
    `  ✓ ${DRILL_BLUEPRINTS.length} תרגילים · ${PROGRAM_BLUEPRINTS.length + 1} תוכניות אימון`,
  );

  return { programVersionIds, drillVersionBySlug };
}
