export type SetTarget = {
  targetMode?: "fixed" | "range" | "max";
  repsMax?: number;
  kg: number;
  reps: number;
  seconds: number;
  rpe?: number;
};
export type Exercise = {
  historyId?: string;
  loadType?: "weight" | "bodyweight";
  perSide?: boolean;
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
export type Result = Pick<SetTarget, "kg" | "reps" | "seconds" | "rpe"> & { status: "done" | "skipped"; recordedAt?: number };
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
  timerSound?: boolean;
  timerVolume?: number;
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
export function formatLoad(exercise: Exercise, kg: number) {
  const value=kg.toLocaleString("it-IT");
  return exercise.loadType === "bodyweight" ? kg ? `PC + ${value} kg` : "PC" : `${value} kg`;
}
export function formatTarget(exercise: Exercise, target: SetTarget) {
  const reps=target.targetMode === "max" ? "max" : target.targetMode === "range" ? `${target.reps}–${target.repsMax ?? target.reps}` : String(target.reps);
  const value=exercise.mode === "time" ? target.targetMode === "max" ? "Tempo max" : `${target.seconds} sec` : `${formatLoad(exercise,target.kg)} × ${reps}`;
  return value+(exercise.perSide ? " per lato" : "");
}
export function formatResult(exercise: Exercise, result: Result) {
  return (exercise.mode === "time" ? `${result.seconds} sec` : `${formatLoad(exercise,result.kg)} × ${result.reps}`)+(exercise.perSide ? " per lato" : "")+(result.rpe === undefined ? "" : ` · RPE ${result.rpe}`);
}
export function lastPerformance(sessions: Session[], current: Session, exercise: Exercise): {session:Session; exercise:Exercise; sets:(Result|null)[]} | null {
  const stamp=(session:Session)=>session.endedAt ?? session.startedAt ?? new Date(`${session.date}T${session.time}:00`).getTime();
  const before=current.startedAt ?? new Date(`${current.date}T${current.time}:00`).getTime();
  const normalize=(name:string)=>name.normalize("NFKC").trim().replace(/\s+/g," ").toLocaleLowerCase("it-IT");
  const compatible=(other:Exercise)=>other.mode===exercise.mode && (other.loadType??"weight")===(exercise.loadType??"weight") && !!other.perSide===!!exercise.perSide;
  for(const session of sessions.filter(s=>s.id!==current.id&&s.status==="completed"&&stamp(s)<before).sort((a,b)=>stamp(b)-stamp(a))) {
    const list=exercises(session.workout).filter(compatible);
    let matches=list.filter(ex=>(ex.historyId??ex.id)===(exercise.historyId??exercise.id) && normalize(ex.name)===normalize(exercise.name));
    if(!matches.length) matches=list.filter(ex=>normalize(ex.name)===normalize(exercise.name));
    if(matches.length!==1)continue;
    const previous=matches[0];
    const sets=previous.sets.map((_,index)=>{
      const result=session.results[key(previous,index)];
      return result?.status==="done" ? result : null;
    });
    if(sets.some(Boolean))return {session,exercise:previous,sets};
  }
  return null;
}
export function appendSessionExercise(session: Session, exercise: Exercise): Session {
  if (session.status !== "active") return session;
  const sectionId = `${session.id}-extra`;
  const sections = session.workout.sections;
  const extra = sections.find((section) => section.id === sectionId);
  return {
    ...session,
    workout: {
      ...session.workout,
      sections: extra
        ? sections.map((section) => section.id === sectionId
          ? { ...section, exercises: [...section.exercises, structuredClone(exercise)] }
          : section)
        : [...sections, { id: sectionId, name: "Extra della sessione", exercises: [structuredClone(exercise)] }],
    },
  };
}
export function removeSessionExercise(session: Session, exerciseId: string): Session {
  if (session.status !== "active") return session;
  return {
    ...session,
    workout: {
      ...session.workout,
      sections: session.workout.sections.map((section) => ({
        ...section,
        exercises: section.exercises.filter((exercise) => exercise.id !== exerciseId),
      })),
    },
    results: Object.fromEntries(Object.entries(session.results).filter(([id]) => !id.startsWith(`${exerciseId}:`))),
  };
}
export function remapRemovedSet<T>(entries: Record<string, T>, exerciseId: string, index: number): Record<string, T> {
  const prefix = `${exerciseId}:`;
  return Object.fromEntries(Object.entries(entries).flatMap(([id, value]) => {
    if (!id.startsWith(prefix)) return [[id, value]];
    const oldIndex = Number(id.slice(prefix.length));
    return oldIndex === index ? [] : [[`${prefix}${oldIndex > index ? oldIndex - 1 : oldIndex}`, value]];
  }));
}
export function changeSessionExercise(session: Session, exerciseId: string, patch: Partial<Pick<Exercise, "rest" | "sets">>): Session {
  if (session.status !== "active") return session;
  return { ...session, workout: { ...session.workout, sections: session.workout.sections.map(section => ({
    ...section, exercises: section.exercises.map(ex => ex.id === exerciseId ? { ...ex, ...structuredClone(patch) } : ex),
  })) } };
}
export function addSessionSet(session: Session, exerciseId: string, actuals: Record<string, SetTarget> = {}): Session {
  const ex = exercises(session.workout).find(ex => ex.id === exerciseId);
  if (!ex || !ex.sets.length) return session;
  const previousId = key(ex, ex.sets.length - 1);
  const previous = session.results[previousId] ?? actuals[previousId] ?? ex.sets.at(-1)!;
  const original=ex.sets.at(-1)!;
  const copied: SetTarget = {...original,kg: previous.kg, reps: original.targetMode === "range" || original.targetMode === "max" ? original.reps : previous.reps, seconds:original.targetMode === "max" ? original.seconds : previous.seconds, rpe:previous.rpe};
  if(previous.rpe===undefined)delete copied.rpe;
  return changeSessionExercise(session, exerciseId, { sets: [...ex.sets, copied] });
}
export function removeSessionSet(session: Session, exerciseId: string, index: number): Session {
  const ex = exercises(session.workout).find(ex => ex.id === exerciseId);
  if (session.status !== "active" || !ex || ex.sets.length <= 1 || !Number.isInteger(index) || index < 0 || index >= ex.sets.length) return session;
  return { ...changeSessionExercise(session, exerciseId, { sets: ex.sets.filter((_, i) => i !== index) }),
    results: remapRemovedSet(session.results, exerciseId, index) };
}
export function prioritizeSessionExercise(session: Session, exerciseId: string): Session {
  if (session.status !== "active") return session;
  const list = exercises(session.workout);
  const current = list.find(ex => ex.sets.some((_, i) => !session.results[key(ex, i)]));
  const chosen = list.find(ex => ex.id === exerciseId);
  if (!current || !chosen || current.id === exerciseId || !chosen.sets.some((_, i) => !session.results[key(chosen, i)])) return session;
  return { ...session, workout: { ...session.workout, sections: session.workout.sections.map(section => ({
    ...section, exercises: section.exercises.filter(ex => ex.id !== exerciseId).flatMap(ex => ex.id === current.id ? [chosen, ex] : [ex]),
  })) } };
}
export function replaceSessionExercise(session: Session, exerciseId: string, replacement: Exercise): Session {
  if (session.status !== "active") return session;
  const old = exercises(session.workout).find(ex => ex.id === exerciseId);
  if (!old || !old.sets.some((_, i) => !session.results[key(old, i)]) || exercises(session.workout).some(ex => ex.id === replacement.id)) return session;
  const recorded = old.sets.map((target, index) => ({target, result:session.results[key(old, index)]})).filter(slot => slot.result);
  const results = Object.fromEntries(Object.entries(session.results).filter(([id]) => !id.startsWith(`${exerciseId}:`)));
  recorded.forEach((slot, i) => { results[`${exerciseId}:${i}`] = slot.result; });
  const retained = { ...old, sets: recorded.map(slot => slot.target) };
  return { ...session, results, workout: { ...session.workout, sections: session.workout.sections.map(section => ({
    ...section, exercises: section.exercises.flatMap(ex => ex.id === exerciseId ? [...(recorded.length ? [retained] : []), structuredClone(replacement)] : [ex]),
  })) } };
}
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
        historyId: ex.historyId ?? ex.id,
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
            ...set,
            kg: result.kg,
            reps: set.targetMode === "range" || set.targetMode === "max" ? set.reps : result.reps,
            seconds: set.targetMode === "max" ? set.seconds : result.seconds,
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
            loadType: "bodyweight",
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
  const values = (t: SetTarget) =>
    t &&
    finite(t.kg) &&
    finite(t.reps) &&
    finite(t.seconds) &&
    (t.rpe === undefined || (finite(t.rpe) && t.rpe <= 10));
  const target = (t:SetTarget) => values(t) &&
    (t.targetMode === undefined || ["fixed","range","max"].includes(t.targetMode)) &&
    (t.repsMax === undefined || (finite(t.repsMax) && t.repsMax >= t.reps)) &&
    (t.targetMode === "range" || t.repsMax === undefined) &&
    (t.targetMode !== "range" || t.repsMax !== undefined);
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
            (ex.historyId === undefined || (typeof ex.historyId === "string" && ex.historyId.length > 0)) &&
            (ex.loadType === undefined || ["weight","bodyweight"].includes(ex.loadType)) &&
            (ex.perSide === undefined || typeof ex.perSide === "boolean") &&
            ["weight", "time"].includes(ex.mode) &&
            finite(ex.rest) &&
            typeof ex.rpe === "boolean" &&
            Array.isArray(ex.sets) &&
            ex.sets.length > 0 &&
            ex.sets.every(t=>target(t) && (ex.mode!=="time" || t.targetMode!=="range"))
        )
    );
  return (
    s.version === 1 &&
    (s.timerSound === undefined || typeof s.timerSound === "boolean") &&
    (s.timerVolume === undefined || (finite(s.timerVolume) && s.timerVolume <= 100)) &&
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
          (r) => values(r) && ["done", "skipped"].includes(r.status) && (r.recordedAt === undefined || finite(r.recordedAt))
        ) &&
        (session.startedAt === undefined || finite(session.startedAt)) &&
        (session.endedAt === undefined || finite(session.endedAt))
    )
  );
}
