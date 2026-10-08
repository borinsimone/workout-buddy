"use client";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { NumberPicker } from "@/components/number-picker";
import { RestTimer } from "@/components/rest-timer";
import { unlockTimerAudio, playTimerAlarm } from "@/lib/timer-audio";
import {
  clock,
  copyWorkout,
  dateKey,
  exercises,
  fromSession,
  initialStore,
  key,
  metrics,
  uid,
  validStore,
  type Exercise,
  type Session,
  type Store,
  type Workout,
} from "@/lib/workout";

type View =
  | "calendar"
  | "history"
  | "settings"
  | "choose"
  | "editor"
  | "detail"
  | "session"
  | "summary";
type Timer = {
  finished?: boolean;
  end: number;
  kind: "rest" | "prep" | "exercise";
  duration: number;
  paused?: number;
};
const formatDay = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
  });
const number = (n: number) => n.toLocaleString("it-IT");
const statusLabel = {
  planned: "Programmato",
  active: "In corso",
  completed: "Fatto",
};
function download(name: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function WorkoutApp() {
  const [store, setStore] = useState<Store | null>(null),
    [view, setView] = useState<View>("calendar");
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date())),
    [sessionId, setSessionId] = useState("");
  const [draft, setDraft] = useState<Workout | null>(null),
    [editExercise, setEditExercise] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const savedDraft = useRef<{
    workout: Workout;
    date: string;
    time: string;
    sessionId: string;
  } | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState(selectedDate),
    [scheduleTime, setScheduleTime] = useState("18:30");
  const [copySource, setCopySource] = useState<Workout | null>(null),
    [toast, setToast] = useState("");
  const [deleted, setDeleted] = useState<Session | null>(null),
    [filter, setFilter] = useState("");
  const [timer, setTimer] = useState<Timer | null>(null);
  const [timerNotice, setTimerNotice] = useState("");
  const [editingSet, setEditingSet] = useState<{
    id: string;
    name: string;
    mode: Exercise["mode"];
    index: number;
    kg: number;
    reps: number;
    seconds: number;
    rpe?: number;
    status: "done" | "skipped" | "pending";
  } | null>(null);
  const [now, setNow] = useState(0),
    [ready, setReady] = useState(false);
  const [actuals, setActuals] = useState<
    Record<string, { kg: number; reps: number; seconds: number; rpe?: number }>
  >({});
  const fileRef = useRef<HTMLInputElement>(null),
    lastSave = useRef("");
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, editExercise]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem("workout-buddy-v1");
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        if (parsed && validStore(parsed)) {
          setStore(parsed);
          const runtimeRaw = localStorage.getItem("workout-buddy-runtime");
          if (runtimeRaw) {
            try {
              const runtime = JSON.parse(runtimeRaw) as {
                sessionId: string;
                timer: Timer | null;
                actuals: typeof actuals;
              };
              if (
                parsed.sessions.some(
                  (s) => s.id === runtime.sessionId && s.status === "active"
                )
              ) {
                setSessionId(runtime.sessionId);
                const t = runtime.timer;
                if (
                  t &&
                  ["rest", "prep", "exercise"].includes(t.kind) &&
                  Number.isFinite(t.end) &&
                  Number.isFinite(t.duration) &&
                  t.duration >= 0 &&
                  (t.paused === undefined ||
                    (Number.isFinite(t.paused) && t.paused >= 0))
                )
                  setTimer(t);
                if (
                  runtime.actuals &&
                  Object.values(runtime.actuals).every(
                    (r) =>
                      r &&
                      [r.kg, r.reps, r.seconds].every(
                        (n) => Number.isFinite(n) && n >= 0
                      )
                  )
                )
                  setActuals(runtime.actuals);
              }
            } catch {
              /* The saved session remains usable if timer state is corrupted. */
            }
          }
        } else setStore(initialStore());
      } catch {
        setStore(initialStore());
        setToast("Impossibile leggere i dati locali.");
      }
      try {
        const raw = localStorage.getItem("workout-buddy-draft");
        if (raw) {
          const saved = JSON.parse(raw);
          if (
            validStore({
              version: 1,
              preparation: 5,
              templates: [saved.workout],
              sessions: [],
            }) &&
            /^\d{4}-\d{2}-\d{2}$/.test(saved.date) &&
            /^([01]\d|2[0-3]):[0-5]\d$/.test(saved.time) &&
            typeof saved.sessionId === "string"
          ) {
            savedDraft.current = saved;
            setHasDraft(true);
          }
        }
      } catch {
        /* Ignore an unreadable draft without modifying saved workouts. */
      }
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!ready || !store) return;
    const value = JSON.stringify(store);
    if (value === lastSave.current) return;
    try {
      localStorage.setItem("workout-buddy-v1", value);
      lastSave.current = value;
    } catch {
      queueMicrotask(() =>
        setToast("Salvataggio non disponibile: esporta un backup.")
      );
    }
  }, [store, ready]);
  useEffect(() => {
    if (!ready || view !== "editor" || !draft) return;
    const saved = {
      workout: draft,
      date: scheduleDate,
      time: scheduleTime,
      sessionId,
    };
    try {
      localStorage.setItem("workout-buddy-draft", JSON.stringify(saved));
      savedDraft.current = saved;
      queueMicrotask(() => setHasDraft(true));
    } catch {
      queueMicrotask(() =>
        setToast("Impossibile salvare la bozza su questo dispositivo.")
      );
    }
  }, [ready, view, draft, scheduleDate, scheduleTime, sessionId]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        "workout-buddy-runtime",
        JSON.stringify({ sessionId, timer, actuals })
      );
    } catch {
      /* Main data persistence reports storage errors to the user. */
    }
  }, [ready, sessionId, timer, actuals]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!timer || timer.paused !== undefined || timer.finished) return;
    if (timer.end > Date.now()) queueMicrotask(() => setTimerNotice(""));
    const timeout = setTimeout(() => {
      if (timer.kind === "prep")
        setTimer({
          kind: "exercise",
          duration: timer.duration,
          end: timer.end + timer.duration * 1000,
        });
      else if (timer.kind === "rest") {
        setTimer({ ...timer, finished: true });
        if (store?.timerSound !== false) playTimerAlarm(store?.timerVolume);
        setTimerNotice("Recupero terminato. Puoi iniziare il prossimo set.");
        setToast("Recupero terminato. Pronto per il prossimo set.");
      } else {
        if (store?.timerSound !== false) playTimerAlarm(store?.timerVolume);
        setTimer({ ...timer, finished: true });
        setTimerNotice(
          "Tempo completato! Conferma il set per registrare il risultato."
        );
      }
    }, Math.max(0, timer.end - Date.now()));
    return () => clearTimeout(timeout);
  }, [timer, store?.timerSound, store?.timerVolume]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  if (!store)
    return (
      <div className="loading">
        workout<span>buddy.</span>
        <p>Prepariamo il tuo spazio.</p>
      </div>
    );
  const session = store.sessions.find((s) => s.id === sessionId);
  const navigate = (v: View) => {
    setView(v);
    setEditExercise(null);
  };
  const updateSession = (patch: Partial<Session>) =>
    setStore({
      ...store,
      sessions: store.sessions.map((s) =>
        s.id === sessionId ? { ...s, ...patch } : s
      ),
    });
  const openSession = (s: Session) => {
    if (s.id !== sessionId) {
      setActuals({});
      setTimer(null);
    }
    setSessionId(s.id);
    navigate(
      s.status === "active"
        ? "session"
        : s.status === "completed"
        ? "summary"
        : "detail"
    );
  };
  const newDraft = () => {
    setDraft({
      id: uid(),
      name: "",
      notes: "",
      sections: [{ id: uid(), name: "Allenamento", exercises: [] }],
    });
    setScheduleDate(selectedDate);
    setSessionId("");
    navigate("editor");
  };
  const saveDraft = (program = false) => {
    if (
      !draft ||
      !draft.name.trim() ||
      !exercises(draft).length ||
      exercises(draft).some((ex) => !ex.name.trim()) ||
      (program && (!scheduleDate || !scheduleTime))
    ) {
      setToast(
        "Inserisci nome e almeno un esercizio. Per programmare serve anche una data."
      );
      return;
    }
    const existing = store.sessions.find(
      (s) => s.id === sessionId && s.status === "planned"
    );
    if (
      program &&
      !existing &&
      store.templates.some((w) => w.id === draft.id)
    ) {
      setToast("Scheda già salvata. Per programmarla usa Copia una scheda.");
      return;
    }
    const planned: Session = {
      id: existing?.id ?? uid(),
      date: scheduleDate,
      time: scheduleTime,
      workout: structuredClone(draft),
      status: "planned",
      results: {},
      notes: "",
    };
    setStore({
      ...store,
      templates: [
        ...store.templates.filter((w) => w.id !== draft.id),
        structuredClone(draft),
      ],
      sessions: !program
        ? store.sessions
        : existing
        ? store.sessions.map((s) => (s.id === existing.id ? planned : s))
        : [...store.sessions, planned],
    });
    if (program) setSelectedDate(scheduleDate);
    setDraft(null);
    setHasDraft(false);
    savedDraft.current = null;
    try {
      localStorage.removeItem("workout-buddy-draft");
    } catch {
      /* Saved workout remains in the main store. */
    }
    navigate("calendar");
    setToast(
      program
        ? "Scheda salvata e allenamento programmato."
        : "Scheda salvata. Nessun allenamento programmato."
    );
  };
  const scheduleCopy = (date: string, time: string) => {
    if (moveId) {
      const moving = store.sessions.find(
        (s) => s.id === moveId && s.status === "planned"
      );
      if (!moving || !date || !time) return;
      setStore({
        ...store,
        sessions: store.sessions.map((s) =>
          s.id === moveId ? { ...s, date, time } : s
        ),
      });
      setSelectedDate(date);
      setMoveId(null);
      navigate("calendar");
      setToast("Allenamento spostato sulla nuova data.");
      return;
    }
    if (!copySource || !date || !time) return;
    setStore({
      ...store,
      sessions: [
        ...store.sessions,
        {
          id: uid(),
          date,
          time,
          workout: copyWorkout(copySource),
          status: "planned",
          results: {},
          notes: "",
        },
      ],
    });
    setSelectedDate(date);
    setCopySource(null);
    navigate("calendar");
    setToast("Allenamento copiato sulla data scelta.");
  };
  const removeSession = (s: Session) => {
    setDeleted(s);
    setStore({
      ...store,
      sessions: store.sessions.filter((item) => item.id !== s.id),
    });
    navigate(s.status === "completed" ? "history" : "calendar");
  };
  const edit = (id: string, patch: Partial<Exercise>) => {
    if (draft)
      setDraft({
        ...draft,
        sections: draft.sections.map((sec) => ({
          ...sec,
          exercises: sec.exercises.map((ex) =>
            ex.id === id ? { ...ex, ...patch } : ex
          ),
        })),
      });
  };
  const allExercises = session ? exercises(session.workout) : [];
  const slots = allExercises.flatMap((ex) =>
    ex.sets.map((target, index) => ({ ex, index, target, id: key(ex, index) }))
  );
  const current = slots.find((slot) => !session?.results[slot.id]);
  const completed = store.sessions
    .filter((s) => s.status === "completed")
    .sort((a, b) => b.date.localeCompare(a.date));
  const selectedSessions = store.sessions
    .filter((s) => s.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));
  const weekStart = new Date(`${selectedDate}T12:00:00`);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const left = timer
    ? timer.paused ?? Math.max(0, Math.ceil((timer.end - now) / 1000))
    : 0;
  const finishSet = (skip = false) => {
    setTimerNotice("");
    if (!session || !current) return;
    const result = actuals[current.id] ?? current.target;
    updateSession({
      results: {
        ...session.results,
        [current.id]: { ...result, status: skip ? "skipped" : "done" },
      },
    });
    setTimer(
      !skip && current.ex.rest
        ? {
            kind: "rest",
            duration: current.ex.rest,
            end: now + current.ex.rest * 1000,
          }
        : null
    );
  };
  const setActual = (
    id: string,
    field: "kg" | "reps" | "seconds" | "rpe",
    value: number,
    target: (typeof slots)[number]["target"]
  ) => {
    if (!session) return;
    const result = session.results[id];
    const next = {
      ...target,
      ...result,
      ...actuals[id],
      [field]: Math.max(0, value),
    };
    if (result)
      updateSession({
        results: {
          ...session.results,
          [id]: { ...next, status: result.status },
        },
      });
    else setActuals({ ...actuals, [id]: next });
  };
  const progress = session ? metrics(session, now) : null,
    activeEx = current?.ex ?? allExercises[allExercises.length - 1];
  const previousSlot = [...slots]
    .reverse()
    .find((slot) => session?.results[slot.id]);
  const currentDraftEx = draft
    ? exercises(draft).find((ex) => ex.id === editExercise)
    : undefined;
  const title =
    view === "calendar"
      ? "Il tuo allenamento."
      : view === "history"
      ? "Storico sessioni"
      : view === "settings"
      ? "Preferenze e dati"
      : view === "choose"
      ? "Come vuoi iniziare?"
      : view === "editor"
      ? editExercise
        ? "Configura esercizio"
        : "Crea la tua scheda"
      : view === "session"
      ? activeEx?.name ?? "Sessione completata"
      : view === "summary"
      ? "Ottimo lavoro."
      : session?.workout.name ?? "Allenamento";
  const subtitle =
    view === "calendar"
      ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString("it-IT", {
          month: "long",
          year: "numeric",
        })
      : view === "history"
      ? `${completed.length} sessioni completate`
      : view === "settings"
      ? "Tutto sotto controllo"
      : view === "session"
      ? `Esercizio ${Math.max(
          1,
          allExercises.findIndex((ex) => ex.id === activeEx?.id) + 1
        )} di ${allExercises.length}`
      : view === "summary"
      ? "Sessione completata"
      : view === "editor"
      ? "Costruisci il tuo prossimo passo"
      : "Nuova programmazione";
  return (
    <div
      className={`app-shell ${view === "session" ? "session-view" : ""}`}
      onPointerDownCapture={() => {
        if (store.timerSound !== false) unlockTimerAudio();
      }}
      onKeyDownCapture={() => {
        if (store.timerSound !== false) unlockTimerAudio();
      }}
    >
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("calendar")}>
          <span className="brand-mark">
            <Icon name="weight" size={25} />
          </span>
          workout<span>buddy</span>
          <b>.</b>
        </button>
        <div className="sidebar-label">IL TUO SPAZIO</div>
        <nav>
          {(
            [
              ["calendar", "calendar", "Calendario"],
              ["history", "history", "Storico"],
              ["settings", "settings", "Preferenze e dati"],
            ] as [View, IconName, string][]
          ).map(([v, i, label]) => (
            <button
              key={v}
              className={view === v ? "nav-item selected" : "nav-item"}
              onClick={() => navigate(v)}
            >
              <Icon name={i} />
              {label}
              {view === v && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="local-dot" /> Dati salvati sul dispositivo
          <p>Il tuo ritmo. I tuoi progressi.</p>
          <small>WORKOUT BUDDY · MVP 0.1</small>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <span>ALLENATI CON INTENZIONE</span>
          <span className="local-label">
            <span className="local-dot" />
            Modalità locale
          </span>
        </header>
        <div className="content">
          <header className="page-header">
            <div>
              {!["calendar", "history", "settings"].includes(view) && (
                <button
                  className="back-button"
                  aria-label="Torna al calendario"
                  onClick={() => navigate("calendar")}
                >
                  <Icon name="back" />
                </button>
              )}
              <p className="eyebrow">{subtitle}</p>
              <h1>{title}</h1>
              {view === "calendar" && (
                <p className="lead">Un set alla volta, un passo avanti.</p>
              )}
            </div>
            {view === "calendar" ? (
              <button
                className="button subtle"
                onClick={() => setSelectedDate(dateKey(new Date()))}
              >
                <Icon name="calendar" />
                Oggi
              </button>
            ) : view === "session" ? (
              <button
                className="button subtle"
                onClick={() => {
                  updateSession({ status: "completed", endedAt: Date.now() });
                  setTimer(null);
                  navigate("summary");
                }}
              >
                Termina
              </button>
            ) : view === "editor" ? (
              <button
                className="button primary small"
                onClick={() => saveDraft(session?.status === "planned")}
              >
                <Icon name="check" />
                Salva
              </button>
            ) : null}
          </header>
          {view === "calendar" && hasDraft && (
            <div className="undo-banner">
              <Icon name="copy" />
              <span>Hai una bozza salvata automaticamente</span>
              <button
                onClick={() => {
                  const saved = savedDraft.current;
                  if (!saved) return;
                  setDraft(structuredClone(saved.workout));
                  setScheduleDate(saved.date);
                  setScheduleTime(saved.time);
                  setSessionId(
                    store.sessions.some(
                      (s) => s.id === saved.sessionId && s.status === "planned"
                    )
                      ? saved.sessionId
                      : ""
                  );
                  navigate("editor");
                }}
              >
                RIPRENDI BOZZA
              </button>
              <button
                aria-label="Elimina bozza"
                onClick={() => {
                  savedDraft.current = null;
                  setHasDraft(false);
                  setDraft(null);
                  try {
                    localStorage.removeItem("workout-buddy-draft");
                  } catch {
                    /* No saved workout is changed. */
                  }
                }}
              >
                ×
              </button>
            </div>
          )}
          {view === "editor" && (
            <p className="subtext">
              Bozza salvata automaticamente su questo dispositivo.
            </p>
          )}
          {view === "calendar" && (
            <>
              <section className="week-card">
                <div className="section-heading">
                  <h2>La tua settimana</h2>
                  <div className="week-navigation">
                    <button
                      aria-label="Settimana precedente"
                      onClick={() => {
                        const d = new Date(weekStart);
                        d.setDate(d.getDate() - 7);
                        setSelectedDate(dateKey(d));
                      }}
                    >
                      <Icon name="back" size={16} />
                    </button>
                    <span>
                      {week[0].getDate()} — {week[6].getDate()}{" "}
                      {week[6].toLocaleDateString("it-IT", { month: "short" })}
                    </span>
                    <button
                      aria-label="Settimana successiva"
                      onClick={() => {
                        const d = new Date(weekStart);
                        d.setDate(d.getDate() + 7);
                        setSelectedDate(dateKey(d));
                      }}
                    >
                      <Icon name="arrow" size={16} />
                    </button>
                  </div>
                </div>
                <div className="week-grid">
                  {week.map((day) => {
                    const date = dateKey(day);
                    return (
                      <button
                        key={date}
                        onClick={() => setSelectedDate(date)}
                        className={`day ${
                          date === selectedDate ? "selected" : ""
                        } ${date === dateKey(new Date()) ? "today" : ""}`}
                      >
                        <span>
                          {day.toLocaleDateString("it-IT", {
                            weekday: "short",
                          })}
                        </span>
                        <strong>{day.getDate()}</strong>
                        <div className="day-dots">
                          {store.sessions
                            .filter((s) => s.date === date)
                            .slice(0, 3)
                            .map((s) => (
                              <i key={s.id} className={s.status} />
                            ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="legend">
                  <span>
                    <i className="planned" />
                    Programmato
                  </span>
                  <span>
                    <i className="active" />
                    In corso
                  </span>
                  <span>
                    <i className="completed" />
                    Completato
                  </span>
                </div>
              </section>
              <div className="dashboard-grid">
                <section>
                  <div className="section-heading day-heading">
                    <div>
                      <p className="eyebrow muted">PROGRAMMA DEL GIORNO</p>
                      <h2 className="capitalize">{formatDay(selectedDate)}</h2>
                      <p className="subtext">
                        {selectedSessions.length} allenamenti in programma
                      </p>
                    </div>
                    <button
                      className="circle-add"
                      aria-label="Crea allenamento"
                      onClick={() => navigate("choose")}
                    >
                      <Icon name="plus" size={25} />
                    </button>
                  </div>
                  {selectedSessions.length ? (
                    selectedSessions.map((s) => {
                      const m = metrics(s);
                      return (
                        <article
                          key={s.id}
                          className={`workout-card ${s.status}`}
                        >
                          <div className="card-top">
                            <span className={`badge ${s.status}`}>
                              {statusLabel[s.status]}
                            </span>
                            <span className="subtext">{s.time}</span>
                          </div>
                          <h3>{s.workout.name}</h3>
                          <p className="subtext">
                            {exercises(s.workout).length} esercizi{" "}
                            <span className="separator">·</span> {m.total} set{" "}
                            {s.status !== "planned" && `· ${m.done} eseguiti`}
                          </p>
                          <div className="exercise-chips">
                            {exercises(s.workout)
                              .slice(0, 3)
                              .map((ex) => (
                                <span key={ex.id}>{ex.name}</span>
                              ))}
                            {exercises(s.workout).length > 3 && (
                              <span>+{exercises(s.workout).length - 3}</span>
                            )}
                          </div>
                          {s.status === "active" && (
                            <div className="progress">
                              <i
                                style={{
                                  width: `${(m.done / m.total) * 100}%`,
                                }}
                              />
                            </div>
                          )}
                          <button
                            className={`button full ${
                              s.status === "completed" ? "subtle" : "primary"
                            }`}
                            onClick={() => openSession(s)}
                          >
                            <Icon
                              name={s.status === "completed" ? "check" : "play"}
                            />
                            {s.status === "active"
                              ? "Riprendi sessione"
                              : s.status === "completed"
                              ? "Vedi riepilogo"
                              : "Apri allenamento"}
                            <Icon name="arrow" size={16} />
                          </button>
                        </article>
                      );
                    })
                  ) : (
                    <div className="empty card">
                      <span className="empty-icon">
                        <Icon name="calendar" size={30} />
                      </span>
                      <h3>Spazio per un nuovo obiettivo.</h3>
                      <p>
                        Nessun allenamento per questo giorno.
                        <br />
                        Crea una scheda o riutilizza una sessione.
                      </p>
                      <button
                        className="button primary"
                        onClick={() => navigate("choose")}
                      >
                        <Icon name="plus" />
                        Programma allenamento
                      </button>
                    </div>
                  )}
                </section>
                <aside className="right-column">
                  <section className="insight-card">
                    <div className="section-heading">
                      <span className="eyebrow">IL TUO PERCORSO</span>
                      <Icon name="trophy" />
                    </div>
                    <h3>
                      La costanza
                      <br />
                      fa la differenza.
                    </h3>
                    <p>
                      Registra quello che fai davvero.
                      <br />
                      Riparti da lì, la prossima volta.
                    </p>
                    <div className="mini-stats">
                      <div>
                        <strong>{completed.length}</strong>
                        <span>SESSIONI</span>
                      </div>
                      <div>
                        <strong>
                          {completed.reduce(
                            (sum, s) => sum + metrics(s).done,
                            0
                          )}
                        </strong>
                        <span>SET ESEGUITI</span>
                      </div>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate("history")}
                    >
                      Esplora il tuo storico <Icon name="arrow" size={16} />
                    </button>
                  </section>
                  <section className="templates">
                    <div className="section-heading">
                      <h2>Le tue schede</h2>
                      <span className="count">{store.templates.length}</span>
                    </div>
                    {store.templates.map((w) => (
                      <div className="template-row" key={w.id}>
                        <button
                          onClick={() => {
                            setDraft(structuredClone(w));
                            setScheduleDate(selectedDate);
                            setSessionId("");
                            navigate("editor");
                          }}
                        >
                          <span className="icon-box">
                            <Icon name="weight" />
                          </span>
                          <span>
                            <strong>{w.name}</strong>
                            <small>
                              {exercises(w).length} esercizi ·{" "}
                              {w.sections.length} sezioni
                            </small>
                          </span>
                          <Icon name="arrow" size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Elimina scheda ${w.name}`}
                          onClick={() => {
                            setStore({
                              ...store,
                              templates: store.templates.filter(
                                (t) => t.id !== w.id
                              ),
                            });
                            setToast(
                              "Scheda eliminata. Le sessioni rimangono nello storico."
                            );
                          }}
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    ))}
                    <button className="text-button" onClick={() => newDraft()}>
                      <Icon name="plus" size={17} />
                      Nuova scheda
                    </button>
                  </section>
                  <p className="quiet-note">
                    <Icon name="settings" size={16} />
                    Nessun account necessario.
                    <br />I tuoi dati restano su questo dispositivo.
                  </p>
                </aside>
              </div>
            </>
          )}
          {view === "choose" && (
            <div className="narrow">
              <p className="lead">
                Parti da zero oppure riusa una struttura che ha già funzionato.
              </p>
              <button
                className="choice-card highlight"
                onClick={() => newDraft()}
              >
                <span className="icon-box">
                  <Icon name="plus" />
                </span>
                <div>
                  <h3>Nuova scheda</h3>
                  <span className="eyebrow">DA ZERO</span>
                  <p>
                    Crea sezioni, aggiungi esercizi e definisci gli obiettivi.
                  </p>
                </div>
                <Icon name="arrow" />
              </button>
              <h2 className="section-title">
                Copia una scheda{" "}
                <span className="count">{store.templates.length}</span>
              </h2>
              {store.templates.map((w) => (
                <button
                  className="choice-card"
                  key={w.id}
                  onClick={() => {
                    setCopySource(w);
                    setScheduleDate(selectedDate);
                  }}
                >
                  <span className="icon-box">
                    <Icon name="copy" />
                  </span>
                  <div>
                    <h3>{w.name}</h3>
                    <p>{exercises(w).length} esercizi · programma su una data</p>
                  </div>
                  <Icon name="arrow" />
                </button>
              ))}
              <h2 className="section-title">Riparti da una sessione</h2>
              {completed.map((s) => (
                <button
                  className="choice-card"
                  key={s.id}
                  onClick={() => {
                    setCopySource(fromSession(s));
                    setScheduleDate(selectedDate);
                  }}
                >
                  <span className="icon-box">
                    <Icon name="history" />
                  </span>
                  <div>
                    <h3>{s.workout.name}</h3>
                    <p>
                      {formatDay(s.date)} · usa i risultati effettivi come
                      obiettivi
                    </p>
                  </div>
                  <Icon name="arrow" />
                </button>
              ))}
              {!completed.length && (
                <p className="subtext">
                  Le sessioni completate appariranno qui.
                </p>
              )}
            </div>
          )}
          {view === "editor" && draft && (
            <div className="narrow">
              {currentDraftEx ? (
                <>
                  <div className="segmented">
                    <button
                      className={
                        currentDraftEx.mode === "weight" ? "selected" : ""
                      }
                      onClick={() =>
                        edit(currentDraftEx.id, { mode: "weight" })
                      }
                    >
                      Carico + ripetizioni
                    </button>
                    <button
                      className={
                        currentDraftEx.mode === "time" ? "selected" : ""
                      }
                      onClick={() => edit(currentDraftEx.id, { mode: "time" })}
                    >
                      Durata
                    </button>
                  </div>
                  <label className="field">
                    Nome esercizio
                    <input
                      value={currentDraftEx.name}
                      onChange={(e) =>
                        edit(currentDraftEx.id, { name: e.target.value })
                      }
                    />
                  </label>
                  <div className="section-heading">
                    <h2>
                      Obiettivi{" "}
                      <span className="count">
                        {currentDraftEx.sets.length} set
                      </span>
                    </h2>
                    <button
                      className="text-button"
                      onClick={() =>
                        edit(currentDraftEx.id, {
                          sets: [
                            ...currentDraftEx.sets,
                            {
                              ...currentDraftEx.sets[
                                currentDraftEx.sets.length - 1
                              ],
                            },
                          ],
                        })
                      }
                    >
                      + Set
                    </button>
                  </div>
                  <div className="card set-config">
                    {currentDraftEx.sets.map((set, i) => (
                      <div className="config-row" key={i}>
                        <span className="set-index">{i + 1}</span>
                        {currentDraftEx.mode === "weight" ? (
                          <>
                            <label>
                              Kg
                              <NumberPicker
                                type="number"
                                min="0"
                                step="0.5"
                                value={set.kg}
                                onChange={(e) =>
                                  edit(currentDraftEx.id, {
                                    sets: currentDraftEx.sets.map((s, index) =>
                                      index === i
                                        ? {
                                            ...s,
                                            kg: Math.max(
                                              0,
                                              Number(e.target.value)
                                            ),
                                          }
                                        : s
                                    ),
                                  })
                                }
                              />
                            </label>
                            <label>
                              Rip.
                              <NumberPicker
                                type="number"
                                min="0"
                                value={set.reps}
                                onChange={(e) =>
                                  edit(currentDraftEx.id, {
                                    sets: currentDraftEx.sets.map((s, index) =>
                                      index === i
                                        ? {
                                            ...s,
                                            reps: Math.max(
                                              0,
                                              Number(e.target.value)
                                            ),
                                          }
                                        : s
                                    ),
                                  })
                                }
                              />
                            </label>
                          </>
                        ) : (
                          <label>
                            Secondi
                            <NumberPicker
                              type="number"
                              min="1"
                              value={set.seconds}
                              onChange={(e) =>
                                edit(currentDraftEx.id, {
                                  sets: currentDraftEx.sets.map((s, index) =>
                                    index === i
                                      ? {
                                          ...s,
                                          seconds: Math.max(
                                            1,
                                            Number(e.target.value)
                                          ),
                                        }
                                      : s
                                  ),
                                })
                              }
                            />
                          </label>
                        )}
                        {currentDraftEx.rpe && (
                          <label>
                            RPE
                            <NumberPicker
                              type="number"
                              min="0"
                              max="10"
                              value={set.rpe ?? ""}
                              onChange={(e) =>
                                edit(currentDraftEx.id, {
                                  sets: currentDraftEx.sets.map((s, index) =>
                                    index === i
                                      ? {
                                          ...s,
                                          rpe:
                                            e.target.value === ""
                                              ? undefined
                                              : Math.min(
                                                  10,
                                                  Math.max(
                                                    0,
                                                    Number(e.target.value)
                                                  )
                                                ),
                                        }
                                      : s
                                  ),
                                })
                              }
                            />
                          </label>
                        )}
                        <button
                          className="icon-button"
                          disabled={currentDraftEx.sets.length === 1}
                          aria-label={`Elimina set ${i + 1}`}
                          onClick={() =>
                            edit(currentDraftEx.id, {
                              sets: currentDraftEx.sets.filter(
                                (_, index) => index !== i
                              ),
                            })
                          }
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <label className="field">
                    Recupero tra i set (secondi)
                    <NumberPicker
                      type="number"
                      min="0"
                      value={currentDraftEx.rest}
                      onChange={(e) =>
                        edit(currentDraftEx.id, {
                          rest: Math.max(0, Number(e.target.value)),
                        })
                      }
                    />
                  </label>
                  <label className="switch-row card">
                    <span>
                      Registra RPE
                      <small>Facoltativo per ogni set eseguito</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={currentDraftEx.rpe}
                      onChange={(e) =>
                        edit(currentDraftEx.id, { rpe: e.target.checked })
                      }
                    />
                  </label>
                  <button
                    className="button primary full"
                    onClick={() => setEditExercise(null)}
                  >
                    <Icon name="check" />
                    Conferma esercizio
                  </button>
                </>
              ) : (
                <>
                  <label className="field">
                    Nome scheda
                    <input
                      placeholder="Es. Forza · Parte superiore"
                      value={draft.name}
                      onChange={(e) =>
                        setDraft({ ...draft, name: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    Note
                    <textarea
                      placeholder="Indicazioni, obiettivi, sensazioni…"
                      value={draft.notes}
                      onChange={(e) =>
                        setDraft({ ...draft, notes: e.target.value })
                      }
                    />
                  </label>
                  <div className="section-heading">
                    <h2>Sezioni</h2>
                    <span className="subtext">
                      {exercises(draft).length} esercizi
                    </span>
                  </div>
                  {draft.sections.map((section, index) => (
                    <section className="card editor-section" key={section.id}>
                      <div className="section-heading">
                        <input
                          aria-label="Nome sezione"
                          className="section-name"
                          value={section.name}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              sections: draft.sections.map((sec) =>
                                sec.id === section.id
                                  ? { ...sec, name: e.target.value }
                                  : sec
                              ),
                            })
                          }
                        />
                        <button
                          className="text-button"
                          disabled={index === 0}
                          aria-label="Sposta sezione in alto"
                          onClick={() => {
                            const secs = [...draft.sections];
                            [secs[index - 1], secs[index]] = [
                              secs[index],
                              secs[index - 1],
                            ];
                            setDraft({ ...draft, sections: secs });
                          }}
                        >
                          ↑
                        </button>
                        <button
                          className="icon-button"
                          aria-label="Elimina sezione"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              sections: draft.sections.filter(
                                (sec) => sec.id !== section.id
                              ),
                            })
                          }
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                      {section.exercises.map((ex) => (
                        <div className="exercise-row" key={ex.id}>
                          <button onClick={() => setEditExercise(ex.id)}>
                            <span className="icon-box">
                              <Icon
                                name={ex.mode === "time" ? "timer" : "weight"}
                              />
                            </span>
                            <span>
                              <strong>{ex.name}</strong>
                              <small>
                                {ex.sets.length} set ·{" "}
                                {ex.mode === "weight"
                                  ? `${ex.sets[0].kg} kg × ${ex.sets[0].reps}`
                                  : `${ex.sets[0].seconds} sec`}{" "}
                                · recupero {clock(ex.rest)}
                              </small>
                            </span>
                            <Icon name="arrow" size={16} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Elimina ${ex.name}`}
                            onClick={() =>
                              setDraft({
                                ...draft,
                                sections: draft.sections.map((sec) =>
                                  sec.id === section.id
                                    ? {
                                        ...sec,
                                        exercises: sec.exercises.filter(
                                          (item) => item.id !== ex.id
                                        ),
                                      }
                                    : sec
                                ),
                              })
                            }
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      ))}
                      <button
                        className="text-button centered"
                        onClick={() => {
                          const ex: Exercise = {
                            id: uid(),
                            name: "Nuovo esercizio",
                            mode: "weight",
                            rest: 90,
                            rpe: false,
                            sets: Array.from({ length: 3 }, () => ({
                              kg: 0,
                              reps: 8,
                              seconds: 60,
                            })),
                          };
                          setDraft({
                            ...draft,
                            sections: draft.sections.map((sec) =>
                              sec.id === section.id
                                ? { ...sec, exercises: [...sec.exercises, ex] }
                                : sec
                            ),
                          });
                          setEditExercise(ex.id);
                        }}
                      >
                        <Icon name="plus" />
                        Aggiungi esercizio
                      </button>
                    </section>
                  ))}
                  <button
                    className="button subtle full"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        sections: [
                          ...draft.sections,
                          {
                            id: uid(),
                            name: `Sezione ${draft.sections.length + 1}`,
                            exercises: [],
                          },
                        ],
                      })
                    }
                  >
                    <Icon name="plus" />
                    Aggiungi sezione
                  </button>
                  {(session?.status === "planned" ||
                    !store.templates.some((w) => w.id === draft.id)) && (
                    <>
                      <div className="card schedule-fields">
                        <h2>Programmazione facoltativa</h2>
                        <label className="field">
                          Data
                          <input
                            required
                            type="date"
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            onInput={(e) =>
                              setScheduleDate(e.currentTarget.value)
                            }
                          />
                        </label>
                        <label className="field">
                          Ora
                          <input
                            required
                            type="time"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                            onInput={(e) =>
                              setScheduleTime(e.currentTarget.value)
                            }
                          />
                        </label>
                      </div>
                      <button
                        className="button primary full"
                        onClick={() => saveDraft(true)}
                      >
                        <Icon name="check" />
                        {session?.status === "planned"
                          ? "Aggiorna allenamento"
                          : "Salva e programma"}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
          {view === "detail" && session && (
            <div className="narrow">
              <div className="card detail-date">
                <span className="date-tile blue">
                  <small>
                    {new Date(session.date + "T12:00:00").toLocaleDateString(
                      "it-IT",
                      { month: "short" }
                    )}
                  </small>
                  <strong>{Number(session.date.slice(-2))}</strong>
                </span>
                <div>
                  <span className="badge planned">Programmato</span>
                  <p>
                    {formatDay(session.date)} · {session.time}
                  </p>
                </div>
              </div>
              <div className="section-heading">
                <h2>
                  Esercizi <span className="count">{allExercises.length}</span>
                </h2>
                <button
                  className="text-button"
                  onClick={() => {
                    setDraft(structuredClone(session.workout));
                    setScheduleDate(session.date);
                    setScheduleTime(session.time);
                    navigate("editor");
                  }}
                >
                  Modifica
                </button>
              </div>
              <div className="card">
                {session.workout.sections.map((sec) => (
                  <div key={sec.id}>
                    <p className="section-label">{sec.name}</p>
                    {sec.exercises.map((ex) => (
                      <div className="exercise-static" key={ex.id}>
                        <span className="icon-box">
                          <Icon
                            name={ex.mode === "time" ? "timer" : "weight"}
                          />
                        </span>
                        <div>
                          <strong>{ex.name}</strong>
                          <small>
                            {ex.sets.length} set ·{" "}
                            {ex.mode === "weight"
                              ? `${ex.sets[0].kg || "PC"} × ${
                                  ex.sets[0].reps
                                } rip`
                              : `${ex.sets[0].seconds} secondi`}
                          </small>
                        </div>
                        <span className="subtext">{clock(ex.rest)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {session.workout.notes && (
                <p className="note">{session.workout.notes}</p>
              )}
              <button
                className="button primary full"
                onClick={() => {
                  updateSession({
                    status: "active",
                    startedAt: session.startedAt ?? Date.now(),
                  });
                  navigate("session");
                  setTimer(null);
                }}
              >
                <Icon name="play" />
                Inizia sessione
              </button>
              <button
                className="button subtle full"
                onClick={() => {
                  setMoveId(session.id);
                  setScheduleDate(session.date);
                  setScheduleTime(session.time);
                }}
              >
                <Icon name="calendar" />
                Sposta data e ora
              </button>
              <div className="two-buttons">
                <button
                  className="button subtle"
                  onClick={() => {
                    setCopySource(session.workout);
                    setScheduleDate(selectedDate);
                  }}
                >
                  <Icon name="copy" />
                  Copia su una data
                </button>
                <button
                  className="button danger"
                  onClick={() => removeSession(session)}
                >
                  <Icon name="trash" />
                  Elimina
                </button>
              </div>
            </div>
          )}
          {view === "session" && session && progress && (
            <div className="narrow">
              <div className="section-heading">
                <span className="subtext">
                  Sessione · {progress.done} di {progress.total} set eseguiti
                </span>
                <span className="subtext">{clock(progress.seconds)}</span>
              </div>
              <div className="progress">
                <i
                  style={{
                    width: `${
                      (progress.done / Math.max(1, progress.total)) * 100
                    }%`,
                  }}
                />
              </div>
              {timer && timer.kind === "rest" && (
                <RestTimer
                  seconds={left}
                  finished={!!timer.finished}
                  paused={timer.paused !== undefined}
                  onExtend={() =>
                    setTimer({
                      ...timer,
                      finished: false,
                      end: Math.max(timer.end, now) + 30000,
                      paused:
                        timer.paused === undefined
                          ? undefined
                          : timer.paused + 30,
                    })
                  }
                  onPause={() =>
                    setTimer(
                      timer.paused === undefined
                        ? { ...timer, paused: left }
                        : {
                            ...timer,
                            end: now + timer.paused * 1000,
                            paused: undefined,
                          }
                    )
                  }
                  onClose={() => setTimer(null)}
                />
              )}
              {current && activeEx?.mode === "time" && (
                <div className="time-exercise">
                  <div
                    className="timer-ring"
                    style={{
                      background: `conic-gradient(var(--lime) ${
                        timer && timer.kind !== "rest"
                          ? Math.min(
                              100,
                              Math.max(
                                0,
                                (((timer.kind === "prep"
                                  ? store.preparation
                                  : current.target.seconds) -
                                  left) /
                                  Math.max(
                                    1,
                                    timer.kind === "prep"
                                      ? store.preparation
                                      : current.target.seconds
                                  )) *
                                  100
                              )
                            )
                          : 0
                      }%, var(--line) 0)`,
                    }}
                  >
                    <div>
                      <span className="badge completed">
                        {timer?.kind === "prep"
                          ? "Preparazione"
                          : timer?.kind === "exercise"
                          ? timer.finished
                            ? "Tempo completato"
                            : "In esecuzione"
                          : "Pronto?"}
                      </span>
                      <strong>
                        {clock(
                          timer && timer.kind !== "rest"
                            ? left
                            : current.target.seconds
                        )}
                      </strong>
                      <small>obiettivo {current.target.seconds} secondi</small>
                    </div>
                  </div>
                  <div className="timer-controls">
                    <button
                      className="button subtle small"
                      disabled={!timer || timer.kind !== "exercise"}
                      onClick={() => {
                        if (timer)
                          setTimer({
                            ...timer,
                            end: timer.end - 10000,
                            finished: false,
                            duration: Math.max(0, timer.duration - 10),
                            paused:
                              timer.paused === undefined
                                ? undefined
                                : Math.max(0, timer.paused - 10),
                          });
                      }}
                    >
                      −10
                    </button>
                    <button
                      className="circle-add"
                      aria-label={
                        timer?.kind === "exercise"
                          ? "Pausa o riprendi timer"
                          : "Avvia timer"
                      }
                      onClick={() => {
                        if (!timer || timer.kind === "rest")
                          setTimer({
                            kind: store.preparation ? "prep" : "exercise",
                            duration: current.target.seconds,
                            end:
                              Date.now() +
                              (store.preparation || current.target.seconds) *
                                1000,
                          });
                        else if (timer.paused !== undefined)
                          setTimer({
                            ...timer,
                            end: Date.now() + timer.paused * 1000,
                            paused: undefined,
                          });
                        else setTimer({ ...timer, paused: left });
                      }}
                    >
                      {timer &&
                      timer.kind !== "rest" &&
                      timer.paused === undefined ? (
                        "Ⅱ"
                      ) : (
                        <Icon name="play" />
                      )}
                    </button>
                    <button
                      className="button subtle small"
                      disabled={!timer || timer.kind !== "exercise"}
                      onClick={() => {
                        if (timer)
                          setTimer({
                            ...timer,
                            end: Math.max(timer.end, now) + 10000,
                            finished: false,
                            duration: timer.duration + 10,
                            paused:
                              timer.paused === undefined
                                ? undefined
                                : timer.paused + 10,
                          });
                      }}
                    >
                      +10
                    </button>
                  </div>
                </div>
              )}
              {activeEx && (
                <>
                  {current && (
                    <div className="current-set-banner">
                      <span className="badge active">SET CORRENTE</span>
                      <strong>
                        Set {current.index + 1} di {current.ex.sets.length}
                      </strong>
                      <span className="subtext">
                        {current.ex.mode === "weight"
                          ? `${current.target.kg || "PC"} × ${
                              current.target.reps
                            } ripetizioni`
                          : `${current.target.seconds} secondi`}
                      </span>
                    </div>
                  )}
                  {timerNotice && (
                    <div className="timer-finished" role="status">
                      <Icon name="check" />
                      <div>
                        <strong>{timerNotice}</strong>
                        <small>Il timer è terminato.</small>
                      </div>
                      <button
                        aria-label="Chiudi avviso timer"
                        onClick={() => setTimerNotice("")}
                      >
                        ×
                      </button>
                    </div>
                  )}
                  <div className="set-table-head">
                    <span>SET</span>
                    <span>OBIETTIVO</span>
                    <span>
                      {activeEx.mode === "weight"
                        ? "KG / RIP EFFETTIVI"
                        : "SECONDI EFFETTIVI"}
                    </span>
                  </div>
                  {activeEx.sets.map((target, index) => {
                    const id = key(activeEx, index),
                      result = session.results[id],
                      value = result ?? actuals[id] ?? target;
                    return (
                      <div
                        key={id}
                        className={`set-row ${
                          current?.id === id ? "current" : ""
                        } ${result?.status === "done" ? "done" : ""}`}
                      >
                        <span className="set-index">
                          {result?.status === "done" ? (
                            <Icon name="check" size={17} />
                          ) : result?.status === "skipped" ? (
                            "—"
                          ) : (
                            index + 1
                          )}
                        </span>
                        <span className="target">
                          {activeEx.mode === "weight"
                            ? `${target.kg || "PC"} × ${target.reps}`
                            : `${target.seconds} sec`}
                        </span>
                        {activeEx.mode === "weight" ? (
                          <>
                            <NumberPicker
                              aria-label={`Kg effettivi set ${index + 1}`}
                              type="number"
                              step="0.5"
                              min="0"
                              value={value.kg}
                              onChange={(e) =>
                                setActual(
                                  id,
                                  "kg",
                                  Number(e.target.value),
                                  target
                                )
                              }
                            />
                            <NumberPicker
                              aria-label={`Ripetizioni effettive set ${
                                index + 1
                              }`}
                              type="number"
                              min="0"
                              value={value.reps}
                              onChange={(e) =>
                                setActual(
                                  id,
                                  "reps",
                                  Number(e.target.value),
                                  target
                                )
                              }
                            />
                          </>
                        ) : (
                          <NumberPicker
                            aria-label={`Secondi effettivi set ${index + 1}`}
                            type="number"
                            min="0"
                            value={value.seconds}
                            onChange={(e) =>
                              setActual(
                                id,
                                "seconds",
                                Number(e.target.value),
                                target
                              )
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </>
              )}
              {current?.ex.rpe && (
                <div className="rpe-row">
                  <strong>RPE facoltativo</strong>
                  <div>
                    {[6, 7, 8, 9, 10].map((rpe) => (
                      <button
                        key={rpe}
                        className={
                          actuals[current.id]?.rpe === rpe ? "selected" : ""
                        }
                        onClick={() =>
                          setActual(current.id, "rpe", rpe, current.target)
                        }
                      >
                        {rpe}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <details className="card review-sets">
                <summary>Rivedi e correggi qualsiasi set</summary>
                {allExercises.map((ex) => (
                  <section key={ex.id}>
                    <h3>{ex.name}</h3>
                    {ex.sets.map((target, index) => {
                      const id = key(ex, index),
                        result = session.results[id];
                      return (
                        <button
                          className="review-set"
                          key={id}
                          onClick={() =>
                            setEditingSet({
                              id,
                              name: ex.name,
                              mode: ex.mode,
                              index,
                              ...(result ?? actuals[id] ?? target),
                              status: result?.status ?? "pending",
                            })
                          }
                        >
                          <span>Set {index + 1}</span>
                          <span>
                            {!result
                              ? "Da eseguire"
                              : result.status === "skipped"
                              ? "Saltato"
                              : ex.mode === "time"
                              ? `${result.seconds} sec`
                              : `${result.kg || "PC"} kg × ${result.reps}`}
                          </span>
                          <span className="lime">Correggi</span>
                        </button>
                      );
                    })}
                  </section>
                ))}
              </details>
              {current ? (
                <div className="session-actions">
                  <button
                    className="button primary full"
                    onClick={() => {
                      setTimerNotice("");
                      if (
                        activeEx?.mode === "time" &&
                        timer?.kind === "exercise"
                      ) {
                        const actual = actuals[current.id] ?? current.target;
                        updateSession({
                          results: {
                            ...session.results,
                            [current.id]: {
                              ...actual,
                              seconds: Math.max(0, timer.duration - left),
                              status: "done",
                            },
                          },
                        });
                        setTimer(
                          current.ex.rest
                            ? {
                                kind: "rest",
                                duration: current.ex.rest,
                                end: now + current.ex.rest * 1000,
                              }
                            : null
                        );
                      } else finishSet();
                    }}
                  >
                    <Icon name="check" />
                    Completa set {current.index + 1}
                  </button>
                  <div className="two-buttons">
                    <button
                      className="button subtle"
                      disabled={!previousSlot}
                      onClick={() => {
                        if (previousSlot) {
                          const results = { ...session.results };
                          const previous = results[previousSlot.id];
                          delete results[previousSlot.id];
                          setActuals({
                            ...actuals,
                            [previousSlot.id]: previous,
                          });
                          updateSession({ results });
                          setTimer(null);
                        }
                      }}
                    >
                      Correggi ultimo
                    </button>
                    <button
                      className="button danger"
                      onClick={() => finishSet(true)}
                    >
                      Salta set
                    </button>
                  </div>
                </div>
              ) : (
                <div className="card empty">
                  <Icon name="check" size={32} />
                  <h2>Tutti i set registrati.</h2>
                  <p>Termina per salvare il riepilogo.</p>
                  <button
                    className="button primary full"
                    onClick={() => {
                      updateSession({
                        status: "completed",
                        endedAt: Date.now(),
                      });
                      setTimer(null);
                      navigate("summary");
                    }}
                  >
                    Termina allenamento
                  </button>
                </div>
              )}
              <label className="field session-notes">
                Note della sessione
                <textarea
                  value={session.notes}
                  onChange={(e) => updateSession({ notes: e.target.value })}
                  placeholder="Come è andata?"
                />
              </label>
            </div>
          )}
          {view === "summary" && session && progress && (
            <div className="narrow">
              <section className="summary-card">
                <div className="section-heading">
                  <h2>{session.workout.name}</h2>
                  <span className="trophy">
                    <Icon name="trophy" size={25} />
                  </span>
                </div>
                <p className="subtext">
                  {formatDay(session.date)} · {session.time}
                </p>
                <div className="stats">
                  <div>
                    <strong>{clock(progress.seconds)}</strong>
                    <span>DURATA</span>
                  </div>
                  <div>
                    <strong className="lime">
                      {progress.done}/{progress.total}
                    </strong>
                    <span>SET ESEGUITI</span>
                  </div>
                  <div>
                    <strong>{number(progress.volume)}</strong>
                    <span>KG VOLUME</span>
                  </div>
                </div>
              </section>
              <h2 className="section-title">Risultati per esercizio</h2>
              <div className="card">
                {allExercises.map((ex) => {
                  const done = ex.sets
                    .map((_, i) => session.results[key(ex, i)])
                    .filter((r) => r?.status === "done");
                  const best = done.reduce(
                    (b, r) =>
                      Math.max(b, ex.mode === "time" ? r.seconds : r.kg),
                    0
                  );
                  const previousBest = completed
                    .filter(
                      (s) =>
                        s.id !== session.id &&
                        (s.endedAt ?? 0) <= (session.endedAt ?? 0)
                    )
                    .flatMap((s) =>
                      exercises(s.workout)
                        .filter((e) => e.name === ex.name && e.mode === ex.mode)
                        .flatMap((e) =>
                          e.sets
                            .map((_, i) => s.results[key(e, i)])
                            .filter((r) => r?.status === "done")
                        )
                    )
                    .reduce(
                      (b, r) =>
                        Math.max(b, ex.mode === "time" ? r.seconds : r.kg),
                      0
                    );
                  const bestSet = done.find(
                    (r) => (ex.mode === "time" ? r.seconds : r.kg) === best
                  );
                  return (
                    <div className="result-row" key={ex.id}>
                      <span
                        className={`result-check ${
                          done.length ? "" : "skipped"
                        }`}
                      >
                        <Icon name="check" size={17} />
                      </span>
                      <div>
                        <strong>{ex.name}</strong>
                        <small>
                          {done.length}/{ex.sets.length} set eseguiti
                        </small>
                        <p className="result-sets">
                          {ex.sets
                            .map((_, i) => {
                              const r = session.results[key(ex, i)];
                              return !r
                                ? "incompleto"
                                : r.status === "skipped"
                                ? "saltato"
                                : ex.mode === "time"
                                ? clock(r.seconds)
                                : `${r.kg || "PC"}×${r.reps}${
                                    r.rpe ? ` (RPE ${r.rpe})` : ""
                                  }`;
                            })
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="result-best">
                        <span>
                          {bestSet
                            ? ex.mode === "time"
                              ? clock(best)
                              : `${number(best)} kg × ${bestSet.reps}`
                            : "—"}
                        </span>
                        {done.length > 0 && best > previousBest && (
                          <span className="badge completed">Record</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="quiet-note">
                Record calcolati solo sui set eseguiti, confrontati con le
                sessioni precedenti.
              </p>
              {session.notes && (
                <div className="note">
                  <span className="eyebrow muted">NOTE SESSIONE</span>
                  <p>{session.notes}</p>
                </div>
              )}
              <button
                className="button primary full"
                onClick={() => {
                  setCopySource(fromSession(session));
                  setScheduleDate(dateKey(new Date()));
                }}
              >
                <Icon name="copy" />
                Riutilizza questa sessione
              </button>
              <div className="two-buttons">
                <button
                  className="button subtle"
                  onClick={() => navigate("history")}
                >
                  <Icon name="history" />
                  Vai allo storico
                </button>
                <button
                  className="button danger"
                  onClick={() => removeSession(session)}
                >
                  <Icon name="trash" />
                  Elimina
                </button>
              </div>
            </div>
          )}
          {view === "history" && (
            <>
              <div className="history-stats stats card">
                <div>
                  <strong>{completed.length}</strong>
                  <span>SESSIONI</span>
                </div>
                <div>
                  <strong>
                    {Math.floor(
                      completed.reduce(
                        (sum, s) => sum + metrics(s).seconds,
                        0
                      ) / 3600
                    )}{" "}
                    h{" "}
                    {Math.floor(
                      (completed.reduce(
                        (sum, s) => sum + metrics(s).seconds,
                        0
                      ) %
                        3600) /
                        60
                    )}
                  </strong>
                  <span>DURATA TOTALE</span>
                </div>
                <div>
                  <strong className="lime">
                    {number(
                      completed.reduce((sum, s) => sum + metrics(s).volume, 0)
                    )}
                  </strong>
                  <span>KG VOLUME</span>
                </div>
              </div>
              <label className="field">
                <span className="sr-only">Cerca sessione</span>
                <input
                  placeholder="Cerca un allenamento…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </label>
              <div className="section-heading">
                <h2>Le tue sessioni</h2>
                <button
                  className="text-button"
                  onClick={() => exportCsv(store)}
                >
                  Esporta CSV <Icon name="download" size={16} />
                </button>
              </div>
              {completed
                .filter((s) =>
                  s.workout.name.toLowerCase().includes(filter.toLowerCase())
                )
                .map((s) => {
                  const m = metrics(s);
                  return (
                    <button
                      className="history-row card"
                      key={s.id}
                      onClick={() => openSession(s)}
                    >
                      <span className="date-tile">
                        <strong>{Number(s.date.slice(-2))}</strong>
                        <small>
                          {new Date(s.date + "T12:00:00").toLocaleDateString(
                            "it-IT",
                            { month: "short" }
                          )}
                        </small>
                      </span>
                      <div>
                        <h3>{s.workout.name}</h3>
                        <small>
                          {formatDay(s.date)} · {clock(m.seconds)} · {m.done}{" "}
                          set eseguiti
                        </small>
                      </div>
                      <span className="history-volume">
                        {number(m.volume)} kg<small>volume</small>
                      </span>
                      <Icon name="arrow" size={18} />
                    </button>
                  );
                })}
              {!completed.length && (
                <div className="empty card">
                  <Icon name="history" size={30} />
                  <h3>Il tuo percorso inizia qui.</h3>
                  <p>
                    Completa il primo allenamento per ritrovarlo nello storico.
                  </p>
                </div>
              )}
            </>
          )}
          {view === "settings" && (
            <div className="narrow">
              <h2 className="section-title">Allenamento</h2>
              <label className="switch-row card">
                <span>
                  Suono a fine timer<small>Recupero ed esercizi a tempo</small>
                </span>
                <input
                  type="checkbox"
                  checked={store.timerSound !== false}
                  onChange={(e) =>
                    setStore({ ...store, timerSound: e.target.checked })
                  }
                />
              </label>
              <div className="card timer-volume">
                <label className="field">
                  <span>Volume timer · {store.timerVolume ?? 80}%</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={store.timerVolume ?? 80}
                    disabled={store.timerSound === false}
                    onChange={(e) =>
                      setStore({ ...store, timerVolume: Number(e.target.value) })
                    }
                  />
                </label>
                <p className="subtext">Regola anche il volume multimediale dell’iPhone.</p>
                <button
                  className="button subtle full"
                  disabled={store.timerSound === false || store.timerVolume === 0}
                  onClick={async () => {
                    await unlockTimerAudio();
                    playTimerAlarm(store.timerVolume);
                  }}
                >
                  Prova suono
                </button>
              </div>
              <div className="card">
                <label className="preference-row">
                  <span className="icon-box">
                    <Icon name="timer" />
                  </span>
                  <span>
                    <strong>Countdown di preparazione</strong>
                    <small>Prima degli esercizi a tempo</small>
                  </span>
                  <select
                    value={store.preparation}
                    onChange={(e) =>
                      setStore({
                        ...store,
                        preparation: Number(e.target.value),
                      })
                    }
                  >
                    {[0, 3, 5, 10, 15].map((n) => (
                      <option value={n} key={n}>
                        {n} sec
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <h2 className="section-title">
                Dati e backup{" "}
                <span className="count">Solo su questo dispositivo</span>
              </h2>
              <div className="local-card">
                <span className="trophy">
                  <Icon name="check" />
                </span>
                <div>
                  <strong>Salvataggio locale</strong>
                  <small>
                    {store.sessions.length} sessioni · {store.templates.length}{" "}
                    schede
                  </small>
                </div>
              </div>
              <div className="card backup-card">
                <button
                  onClick={() =>
                    download(
                      `workout-buddy-${dateKey(new Date())}.json`,
                      JSON.stringify(store, null, 2),
                      "application/json"
                    )
                  }
                >
                  <span className="icon-box">
                    <Icon name="download" />
                  </span>
                  <span>
                    <strong>Esporta backup</strong>
                    <small>
                      Scarica tutte le schede, sessioni e preferenze
                    </small>
                  </span>
                  <Icon name="arrow" size={18} />
                </button>
                <button onClick={() => fileRef.current?.click()}>
                  <span className="icon-box">
                    <Icon name="upload" />
                  </span>
                  <span>
                    <strong>Importa backup</strong>
                    <small>Unisce i dati, mantenendo quelli già presenti</small>
                  </span>
                  <Icon name="arrow" size={18} />
                </button>
                <button onClick={() => exportCsv(store)}>
                  <span className="icon-box">
                    <Icon name="calendar" />
                  </span>
                  <span>
                    <strong>Esporta storico CSV</strong>
                    <small>Risultati effettivi per ogni set</small>
                  </span>
                  <Icon name="arrow" size={18} />
                </button>
              </div>
              <input
                type="file"
                accept=".json,application/json"
                hidden
                ref={fileRef}
                onChange={async (e) => {
                  const input = e.currentTarget;
                  const file = input.files?.[0];
                  if (!file) return;
                  try {
                    const parsed: unknown = JSON.parse(await file.text());
                    if (!validStore(parsed)) throw new Error("invalid");
                    setStore({
                      ...store,
                      templates: [
                        ...store.templates,
                        ...parsed.templates.filter(
                          (w) => !store.templates.some((t) => t.id === w.id)
                        ),
                      ],
                      sessions: [
                        ...store.sessions,
                        ...parsed.sessions.filter(
                          (s) => !store.sessions.some((t) => t.id === s.id)
                        ),
                      ],
                    });
                    setToast(
                      "Backup importato. I dati già presenti sono stati mantenuti."
                    );
                  } catch {
                    setToast("Backup non valido. Nessun dato modificato.");
                  }
                  input.value = "";
                }}
              />
              <p className="note">
                Nessun account, nessun cloud. Esporta regolarmente un backup:
                cancellare i dati del browser elimina anche quelli dell’app.
              </p>
              <p className="version">Workout Buddy · base MVP 0.1</p>
            </div>
          )}
          {deleted && (
            <div className="undo-banner">
              <Icon name="trash" />
              <span>Allenamento eliminato</span>
              <button
                onClick={() => {
                  setStore({
                    ...store,
                    sessions: [...store.sessions, deleted],
                  });
                  setDeleted(null);
                }}
              >
                ANNULLA
              </button>
              <button
                aria-label="Chiudi avviso"
                onClick={() => setDeleted(null)}
              >
                ×
              </button>
            </div>
          )}
        </div>
      </main>
      <nav className="mobile-nav">
        {(
          [
            ["calendar", "calendar", "Oggi"],
            ["history", "history", "Storico"],
            ["settings", "settings", "Dati"],
          ] as [View, IconName, string][]
        ).map(([v, i, label]) => (
          <button
            key={v}
            className={view === v ? "selected" : ""}
            onClick={() => navigate(v)}
          >
            <Icon name={i} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {(copySource || moveId) && (
        <div className="modal-overlay">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="copy-title"
            className="modal card"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              scheduleCopy(String(data.get("date")), String(data.get("time")));
            }}
          >
            <div className="section-heading">
              <h2 id="copy-title">
                {moveId ? "Sposta allenamento" : "Copia su una nuova data"}
              </h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Chiudi"
                onClick={() => {
                  setCopySource(null);
                  setMoveId(null);
                }}
              >
                ×
              </button>
            </div>
            <p className="subtext">
              {copySource?.name ??
                store.sessions.find((s) => s.id === moveId)?.workout.name}
            </p>
            <label className="field">
              Data
              <input
                type="date"
                name="date"
                required
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                onInput={(e) => setScheduleDate(e.currentTarget.value)}
              />
            </label>
            <label className="field">
              Ora
              <input
                type="time"
                name="time"
                required
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                onInput={(e) => setScheduleTime(e.currentTarget.value)}
              />
            </label>
            <button
              className="button primary full"
              disabled={!scheduleDate || !scheduleTime}
              type="submit"
            >
              <Icon name="copy" />
              {moveId ? "Conferma spostamento" : "Copia e programma"}
            </button>
          </form>
        </div>
      )}
      {editingSet && (
        <div className="modal-overlay">
          <form
            className="modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-set-title"
            onSubmit={(e) => {
              e.preventDefault();
              if (!session) return;
              const results = { ...session.results };
              const { id, kg, reps, seconds, rpe, status } = editingSet;
              if (status === "pending") {
                delete results[id];
                setActuals({ ...actuals, [id]: { kg, reps, seconds, rpe } });
              } else results[id] = { kg, reps, seconds, rpe, status };
              updateSession({ results });
              setEditingSet(null);
              if (
                editingSet.id === current?.id ||
                (editingSet.status === "pending" &&
                  session.results[editingSet.id])
              ) {
                setTimer(null);
                setTimerNotice("");
              }
              setToast("Set corretto. Riepilogo e record aggiornati.");
            }}
          >
            <div className="section-heading">
              <h2 id="edit-set-title">Correggi set {editingSet.index + 1}</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Chiudi correzione"
                onClick={() => setEditingSet(null)}
              >
                ×
              </button>
            </div>
            <p className="subtext">{editingSet.name}</p>
            {(editingSet.mode === "weight" ? ["kg", "reps"] : ["seconds"]).map(
              (field) => (
                <label className="field" key={field}>
                  {field === "kg"
                    ? "Carico effettivo (kg)"
                    : field === "reps"
                    ? "Ripetizioni effettive"
                    : "Durata effettiva (secondi)"}
                  <NumberPicker
                    type="number"
                    min="0"
                    step={field === "kg" ? "0.5" : "1"}
                    required
                    value={editingSet[field as "kg" | "reps" | "seconds"]}
                    onChange={(e) =>
                      setEditingSet({
                        ...editingSet,
                        [field]: Math.max(0, Number(e.target.value)),
                      })
                    }
                  />
                </label>
              )
            )}
            <label className="field">
              RPE facoltativo
              <NumberPicker
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={editingSet.rpe ?? ""}
                onChange={(e) =>
                  setEditingSet({
                    ...editingSet,
                    rpe:
                      e.target.value === ""
                        ? undefined
                        : Math.min(10, Math.max(0, Number(e.target.value))),
                  })
                }
              />
            </label>
            <label className="field">
              Stato del set
              <select
                value={editingSet.status}
                onChange={(e) =>
                  setEditingSet({
                    ...editingSet,
                    status: e.target.value as "done" | "skipped" | "pending",
                  })
                }
              >
                <option value="done">Eseguito</option>
                <option value="skipped">Saltato</option>
                <option value="pending">Da eseguire</option>
              </select>
            </label>
            <button className="button primary full" type="submit">
              <Icon name="check" />
              Salva correzione
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
function exportCsv(store: Store) {
  const escape = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
  const rows: (string | number)[][] = [
    [
      "Data",
      "Allenamento",
      "Esercizio",
      "Set",
      "Stato",
      "Kg",
      "Ripetizioni",
      "Secondi",
      "RPE",
    ],
  ];
  store.sessions
    .filter((s) => s.status === "completed")
    .forEach((s) =>
      exercises(s.workout).forEach((ex) =>
        ex.sets.forEach((_, i) => {
          const r = s.results[key(ex, i)];
          rows.push([
            s.date,
            s.workout.name,
            ex.name,
            i + 1,
            r?.status ?? "incompleto",
            r?.status === "done" ? r.kg : "",
            r?.status === "done" ? r.reps : "",
            r?.status === "done" ? r.seconds : "",
            r?.status === "done" ? r.rpe ?? "" : "",
          ]);
        })
      )
    );
  download(
    "workout-storico.csv",
    "\uFEFF" + rows.map((row) => row.map(escape).join(";")).join("\r\n"),
    "text/csv;charset=utf-8"
  );
}
