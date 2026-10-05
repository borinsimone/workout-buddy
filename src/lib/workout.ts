export type SetTarget = {
  kg: number;
  reps: number;
  seconds: number;
  rpe?: number;
};
export type Exercise = {
  id: string;
  name: string;
  mode: "weight" | "time";
  rest: number;
  rpe: boolean;
  sets: SetTarget[];
};
export type Section = { id: string; name: string; exercises: Exercise[] };
export type Workout = {
  id: string;
  name: string;
  notes: string;
  sections: Section[];
};
export type Result = SetTarget & { status: "done" | "skipped" };
export type Session = {
  id: string;
  date: string;
  time: string;
  workout: Workout;
  status: "planned" | "active" | "completed";
  startedAt?: number;
  endedAt?: number;
  results: Record<string, Result>;
  notes: string;
};
export type Store = {
  version: 1;
  templates: Workout[];
  sessions: Session[];
  preparation: number;
};
export const uid = () => crypto.randomUUID();
export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}
export const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    Math.floor(seconds % 60)
  ).padStart(2, "0")}`;
export const exercises = (workout: Workout) =>
  workout.sections.flatMap((section) => section.exercises);
export const key = (exercise: Exercise, index: number) =>
  `${exercise.id}:${index}`;
export function metrics(session: Session, now = Date.now()) {
  const done = exercises(session.workout)
    .flatMap((ex) =>
      ex.sets.map((_, index) => ({
        ex,
        result: session.results[key(ex, index)],
      }))
    )
    .filter(({ result }) => result?.status === "done");
  return {
    done: done.length,
    total: exercises(session.workout).reduce(
      (sum, ex) => sum + ex.sets.length,
      0
    ),
    volume: done.reduce(
      (sum, { ex, result }) =>
        sum + (ex.mode === "weight" ? result.kg * result.reps : 0),
      0
    ),
    seconds: session.startedAt
      ? Math.max(
          0,
          Math.floor(((session.endedAt ?? now) - session.startedAt) / 1000)
        )
      : 0,
  };
}
export function copyWorkout(workout: Workout): Workout {
  return {
    ...structuredClone(workout),
    id: uid(),
    sections: workout.sections.map((section) => ({
      ...section,
      id: uid(),
      exercises: section.exercises.map((ex) => ({
        ...structuredClone(ex),
        id: uid(),
      })),
    })),
  };
}
export function fromSession(session: Session): Workout {
  const workout = structuredClone(session.workout);
  for (const ex of exercises(workout))
    ex.sets = ex.sets.map((set, index) => {
      const result = session.results[key(ex, index)];
      return result?.status === "done"
        ? {
            kg: result.kg,
            reps: result.reps,
            seconds: result.seconds,
            rpe: result.rpe,
          }
        : set;
    });
  return copyWorkout(workout);
}
export function initialStore(): Store {
  const target = (kg: number, reps: number, seconds = 60): SetTarget => ({
    kg,
    reps,
    seconds,
  });
  const workout: Workout = {
    id: "upper",
    name: "Forza · Parte superiore",
    notes:
      "Controllo tecnico, lascia 2 ripetizioni in riserva. Cura la traiettoria.",
    sections: [
      {
        id: "push",
        name: "Spinta",
        exercises: [
          {
            id: "bench",
            name: "Panca piana bilanciere",
            mode: "weight",
            rest: 120,
            rpe: true,
            sets: [
              target(70, 8),
              target(72.5, 8),
              target(75, 6),
              target(75, 6),
            ],
          },
          {
            id: "press",
            name: "Military press",
            mode: "weight",
            rest: 90,
            rpe: true,
            sets: [target(30, 8), target(30, 8), target(30, 8)],
          },
        ],
      },
      {
        id: "pull",
        name: "Tirata e core",
        exercises: [
          {
            id: "pullup",
            name: "Trazioni prone",
            mode: "weight",
            rest: 120,
            rpe: false,
            sets: [target(0, 5), target(0, 5), target(0, 5)],
          },
          {
            id: "plank",
            name: "Plank frontale",
            mode: "time",
            rest: 60,
            rpe: false,
            sets: [target(0, 0, 60), target(0, 0, 60), target(0, 0, 60)],
          },
        ],
      },
    ],
  };
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 2);
  const results: Record<string, Result> = {};
  exercises(workout).forEach((ex) =>
    ex.sets.forEach((set, index) => {
      results[key(ex, index)] = { ...set, status: "done" };
    })
  );
  return {
    version: 1,
    templates: [workout],
    preparation: 5,
    sessions: [
      {
        id: "demo-plan",
        date: dateKey(today),
        time: "18:30",
        workout: structuredClone(workout),
        status: "planned",
        results: {},
        notes: "",
      },
      {
        id: "demo-history",
        date: dateKey(yesterday),
        time: "18:30",
        workout: structuredClone(workout),
        status: "completed",
        startedAt: yesterday.getTime() - 3360000,
        endedAt: yesterday.getTime(),
        results,
        notes: "Buone sensazioni. Mantieni il controllo nell’ultima serie.",
      },
    ],
  };
}
export function validStore(value: unknown): value is Store {
  if (!value || typeof value !== "object") return false;
  const s = value as Store;
  const finite = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) && n >= 0;
  const target = (t: SetTarget) =>
    t &&
    finite(t.kg) &&
    finite(t.reps) &&
    finite(t.seconds) &&
    (t.rpe === undefined || (finite(t.rpe) && t.rpe <= 10));
  const workout = (w: Workout) =>
    w &&
    typeof w.id === "string" &&
    typeof w.name === "string" &&
    typeof w.notes === "string" &&
    Array.isArray(w.sections) &&
    w.sections.every(
      (sec) =>
        sec &&
        typeof sec.id === "string" &&
        typeof sec.name === "string" &&
        Array.isArray(sec.exercises) &&
        sec.exercises.every(
          (ex) =>
            ex &&
            typeof ex.id === "string" &&
            typeof ex.name === "string" &&
            ["weight", "time"].includes(ex.mode) &&
            finite(ex.rest) &&
            typeof ex.rpe === "boolean" &&
            Array.isArray(ex.sets) &&
            ex.sets.length > 0 &&
            ex.sets.every(target)
        )
    );
  return (
    s.version === 1 &&
    finite(s.preparation) &&
    s.preparation <= 60 &&
    Array.isArray(s.templates) &&
    s.templates.every(workout) &&
    Array.isArray(s.sessions) &&
    s.sessions.every(
      (session) =>
        session &&
        typeof session.id === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(session.date) &&
        Number.isFinite(new Date(session.date + "T12:00:00").getTime()) &&
        dateKey(new Date(session.date + "T12:00:00")) === session.date &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(session.time) &&
        workout(session.workout) &&
        ["planned", "active", "completed"].includes(session.status) &&
        typeof session.notes === "string" &&
        session.results &&
        typeof session.results === "object" &&
        !Array.isArray(session.results) &&
        Object.values(session.results).every(
          (r) => target(r) && ["done", "skipped"].includes(r.status)
        ) &&
        (session.startedAt === undefined || finite(session.startedAt)) &&
        (session.endedAt === undefined || finite(session.endedAt))
    )
  );
}
