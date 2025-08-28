import React, { useEffect, useMemo, useState } from "react";

// --- The 25 D/E-level words ---
const WORDS = [
  "see","went","I","an","up",
  "here","by","the","am","look",
  "in","put","love","my","some",
  "big","a","has","on","is",
  "get","yes","for","play","little",
  "with","of","what","to",
] as const;

type Status = "correct" | "incorrect" | "skipped" | null;
type StoreShape = { statuses: Record<string, Status>; index: number; };
const STORAGE_KEY = "vocab_trainer_progress_v1";

function loadStore(): StoreShape | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const statuses: Record<string, Status> = {};
    WORDS.forEach((w) => {
      const s = parsed.statuses?.[w] ?? null;
      statuses[w] = s === "correct" || s === "incorrect" || s === "skipped" ? s : null;
    });
    const index = Math.min(Math.max(Number(parsed.index) || 0, 0), WORDS.length - 1);
    return { statuses, index };
  } catch { return null; }
}

function saveStore(data: StoreShape) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

export default function App() {
  const [statuses, setStatuses] = useState<Record<string, Status>>(() => {
    const loaded = loadStore();
    if (loaded) return loaded.statuses;
    const base: Record<string, Status> = {}; WORDS.forEach((w) => base[w] = null); return base;
  });
  const [index, setIndex] = useState<number>(() => loadStore()?.index ?? 0);
  const [view, setView] = useState<"trainer" | "summary">("trainer");

  const groups = useMemo(() => {
    const correct: string[] = [], incorrect: string[] = [], notAnswered: string[] = [];
    WORDS.forEach((w) => {
      const s = statuses[w];
      if (s === "correct") correct.push(w);
      else if (s === "incorrect") incorrect.push(w);
      else notAnswered.push(w); // includes null + skipped
    });
    return { correct, incorrect, notAnswered };
  }, [statuses]);

  const answeredCount = groups.correct.length + groups.incorrect.length;
  const progressPercent = Math.round((answeredCount / WORDS.length) * 100);
  const allDone = groups.notAnswered.length === 0;

  useEffect(() => { saveStore({ statuses, index }); }, [statuses, index]);

  // Keyboard shortcuts
  useEffect(() => {
    if (view !== "trainer") return;
    const handler = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "c") handleMark("correct");
      if (k === "x") handleMark("incorrect");
      if (k === "s") handleMark("skipped");
      if (e.key === "ArrowRight" || e.key === " ") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, index, statuses]);

  function nextIndex(from = index) {
    if (from < WORDS.length - 1) return from + 1;
    const remaining = WORDS.findIndex((w) => statuses[w] === null || statuses[w] === "skipped");
    return remaining === -1 ? from : remaining;
  }
  function prev() { setIndex((i) => (i > 0 ? i - 1 : 0)); }
  function next() {
    const ni = nextIndex(index);
    if (ni === index) setView("summary"); else setIndex(ni);
  }
  function handleMark(mark: Exclude<Status, null>) {
    const word = WORDS[index];
    setStatuses((prev) => ({ ...prev, [word]: mark }));
    const ni = nextIndex(index);
    if (ni === index) setView("summary"); else setIndex(ni);
  }
  function resetAll() {
    const cleared: Record<string, Status> = {};
    WORDS.forEach((w) => (cleared[w] = null));
    setStatuses(cleared); setIndex(0); setView("trainer");
  }
  function jumpToWord(w: string) {
    const i = WORDS.indexOf(w as any);
    if (i >= 0) { setIndex(i); setView("trainer"); }
  }

  return (
    <div>
      <header>
        <div className="header-inner">
          <div className="header-title">Charlie's Words</div>
          <div className="header-actions">
            <button className="btn btn-small" onClick={() => setView(view === "trainer" ? "summary" : "trainer")}>
              {view === "trainer" ? "Summary" : "Back to Practice"}
            </button>
            <button className="btn btn-small" onClick={resetAll} title="Clear progress">Reset</button>
          </div>
        </div>
        <div className="progress-wrap">
          <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
        </div>
      </header>

      {view === "trainer" ? (
        <TrainerView
          word={WORDS[index]}
          index={index}
          total={WORDS.length}
          status={statuses[WORDS[index]]}
          onMark={handleMark}
          onPrev={prev}
          onNext={next}
          allDone={allDone}
        />
      ) : (
        <SummaryView groups={groups} jumpToWord={jumpToWord} />
      )}

      <footer>
        <p>
          Tip: Use keyboard shortcuts — <b>C</b> for ✓, <b>X</b> for ✗, <b>S</b> to skip,
          <b> Space/→</b> next.
        </p>
      </footer>
    </div>
  );
}

function TrainerView({
  word, index, total, status, onMark, onPrev, onNext, allDone,
}: {
  word: string; index: number; total: number; status: Status;
  onMark: (mark: Exclude<Status, null>) => void; onPrev: () => void; onNext: () => void; allDone: boolean;
}) {
  return (
    <main>
      <div className="row" style={{ marginBottom: 16 }}>
        <div className="meta">Word {index + 1} of {total}</div>
        {status && (
          <span
            className={
              "badge " +
              (status === "correct" ? "badge-green" : status === "incorrect" ? "badge-red" : "badge-amber")
            }
            aria-live="polite"
          >
            {status === "correct" ? "Marked ✓ correct" : status === "incorrect" ? "Marked ✗ incorrect" : "Marked skip"}
          </span>
        )}
      </div>

      <div className="word-card">
        <span>{word}</span>
      </div>

      <div style={{ height: 12 }} />

      <div className="btn-row">
        <button onClick={() => onMark("correct")} className="btn btn-green">✓ Correct</button>
        <button onClick={() => onMark("incorrect")} className="btn btn-red">✗ Incorrect</button>
        <button onClick={() => onMark("skipped")} className="btn btn-amber">Skip</button>
      </div>

      <div style={{ height: 12 }} />

      <div className="row">
        <button onClick={onPrev} className="btn btn-small">← Prev</button>
        {!allDone ? (
          <button onClick={onNext} className="btn btn-small">Next →</button>
        ) : (
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="btn btn-small">
            All words reviewed — open Summary ▲
          </button>
        )}
      </div>
    </main>
  );
}

function SummaryView({
  groups, jumpToWord,
}: {
  groups: { correct: string[]; incorrect: string[]; notAnswered: string[] };
  jumpToWord: (w: string) => void;
}) {
  return (
    <main>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Summary</h2>
      <div className="grid">
        <SummaryColumn title="Correct" tone="green" words={groups.correct} onSelect={jumpToWord} />
        <SummaryColumn title="Incorrect" tone="red" words={groups.incorrect} onSelect={jumpToWord} />
        <SummaryColumn title="Not Answered" tone="amber" words={groups.notAnswered} onSelect={jumpToWord} />
      </div>
    </main>
  );
}

function SummaryColumn({
  title, tone, words, onSelect,
}: {
  title: string; tone: "green" | "red" | "amber"; words: string[]; onSelect: (w: string) => void;
}) {
  const pill = tone === "green" ? "badge badge-green" : tone === "red" ? "badge badge-red" : "badge badge-amber";
  return (
    <section className="card">
      <div className="card-head">
        <h3 className="card-title">{title}</h3>
        <span className={pill}>{words.length}</span>
      </div>
      <ul className="list">
        {words.length === 0 && <li><div style={{ padding: 16, color: "#64748b", fontSize: 14 }}>None</div></li>}
        {words.map((w) => (
          <li key={w}>
            <button onClick={() => onSelect(w)} title="Open word to practice">
              {w}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
