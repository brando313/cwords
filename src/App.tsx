import React, { useEffect, useMemo, useState } from "react";

/** ---- Types & helpers ---- */
type Status = "correct" | "incorrect" | "skipped" | null;

function simpleHash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function parseWords(txt: string): string[] {
  return txt
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 100);   // keep original casing
}

/** Load /public/cwords.txt with a simple relative path */
async function loadTxt(): Promise<string[]> {
  const res = await fetch("./cwords.txt", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load cwords.txt (${res.status})`);
  const txt = await res.text();
  const words = parseWords(txt);
  if (words.length === 0) throw new Error("cwords.txt has no words");
  return words;
}

export default function App() {
  const [words, setWords] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [index, setIndex] = useState(0);
  const [view, setView] = useState<"trainer" | "summary">("trainer");
  const [storeKey, setStoreKey] = useState<string>("");

  // Load words on mount
  useEffect(() => {
    (async () => {
      try {
        const w = await loadTxt();
        setWords(w);

        const key = "vocab_progress_" + simpleHash(w.join("\n"));
        setStoreKey(key);

        // restore progress if present
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            setIndex(Math.min(Math.max(Number(parsed.index) || 0, 0), w.length - 1));
            // Ensure we have an entry for each word
            const restored: Record<string, Status> = {};
            w.forEach((word) => {
              const s = parsed.statuses?.[word] ?? null;
              restored[word] = s === "correct" || s === "incorrect" || s === "skipped" ? s : null;
            });
            setStatuses(restored);
          } catch {
            const init: Record<string, Status> = {};
            w.forEach((word) => (init[word] = null));
            setStatuses(init);
            setIndex(0);
          }
        } else {
          const init: Record<string, Status> = {};
          w.forEach((word) => (init[word] = null));
          setStatuses(init);
          setIndex(0);
        }
      } catch (e: any) {
        setError(e?.message || "Could not load cwords.txt");
      }
    })();
  }, []);

  // Persist progress
  useEffect(() => {
    if (!storeKey || !words) return;
    try {
      localStorage.setItem(storeKey, JSON.stringify({ statuses, index }));
    } catch {}
  }, [storeKey, statuses, index, words]);

  // Derived groups
  const groups = useMemo(() => {
    const correct: string[] = [], incorrect: string[] = [], notAnswered: string[] = [];
    (words ?? []).forEach((w) => {
      const s = statuses[w];
      if (s === "correct") correct.push(w);
      else if (s === "incorrect") incorrect.push(w);
      else notAnswered.push(w);
    });
    return { correct, incorrect, notAnswered };
  }, [words, statuses]);

  const answeredCount = groups.correct.length + groups.incorrect.length;
  const total = words?.length ?? 0;
  const progressPercent = total ? Math.round((answeredCount / total) * 100) : 0;
  const allDone = total > 0 && groups.notAnswered.length === 0;

  /** Find the next index whose status is NOT "correct".
   *  Starts from current+1, wraps around once. Returns -1 if none found.
   */
  function findNextNonCorrect(from: number): number {
    if (!words || words.length === 0) return -1;
    const n = words.length;
    for (let step = 1; step <= n; step++) {
      const i = (from + step) % n;
      const w = words[i];
      if (statuses[w] !== "correct") return i;
    }
    return -1;
  }

  function prev() {
    setIndex((i) => (i > 0 ? i - 1 : 0));
  }

  function next() {
    const ni = findNextNonCorrect(index);
    if (ni === -1) setView("summary");
    else setIndex(ni);
  }

  function handleMark(mark: Exclude<Status, null>) {
    if (!words) return;
    const w = words[index];
    setStatuses((prev) => ({ ...prev, [w]: mark }));
    // After marking, always go to the next non-correct word (skip any already-correct)
    const ni = findNextNonCorrect(index);
    if (ni === -1) setView("summary");
    else setIndex(ni);
  }

  function resetAll() {
    if (!words) return;
    const cleared: Record<string, Status> = {};
    words.forEach((w) => (cleared[w] = null));
    setStatuses(cleared);
    setIndex(0);
    setView("trainer");
  }

  function jumpToWord(w: string) {
    if (!words) return;
    const i = words.indexOf(w);
    if (i >= 0) {
      setIndex(i);
      setView("trainer");
    }
  }

  async function reloadWords() {
    setError(null);
    try {
      const w = await loadTxt();
      setWords(w);
      const key = "vocab_progress_" + simpleHash(w.join("\n"));
      setStoreKey(key);
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        setIndex(Math.min(Math.max(Number(parsed.index) || 0, 0), w.length - 1));
        const restored: Record<string, Status> = {};
        w.forEach((word) => {
          const s = parsed.statuses?.[word] ?? null;
          restored[word] = s === "correct" || s === "incorrect" || s === "skipped" ? s : null;
        });
        setStatuses(restored);
      } else {
        const init: Record<string, Status> = {};
        w.forEach((word) => (init[word] = null));
        setStatuses(init);
        setIndex(0);
      }
    } catch (e: any) {
      setError(e?.message || "Could not reload cwords.txt");
    }
  }

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
  }, [view, index, statuses, words]);

  return (
    <div>
      <header>
        <div className="header-inner">
          <div className="header-title">Charlie&apos;s Words</div>
          <div className="header-actions" style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-small" onClick={() => setView(view === "trainer" ? "summary" : "trainer")}>
              {view === "trainer" ? "Summary" : "Back to Practice"}
            </button>
            <button className="btn btn-small" onClick={resetAll} title="Clear progress">Reset</button>
            <button className="btn btn-small" onClick={reloadWords} title="Reload cwords.txt">Reload words</button>
          </div>
        </div>
        <div className="progress-wrap">
          <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
        </div>
      </header>

      {!words && !error && (
        <main><div className="meta">Loading cwords.txt…</div></main>
      )}
      {error && (
        <main><div className="meta" style={{ color: "#b91c1c" }}>Error: {error}</div></main>
      )}
      {words && !error && (
        view === "trainer" ? (
          <TrainerView
            word={words[index]}
            index={index}
            total={words.length}
            status={statuses[words[index]]}
            onMark={handleMark}
            onPrev={prev}
            onNext={next}
            allDone={allDone}
          />
        ) : (
          <SummaryView
            groups={{
              correct: Object.keys(statuses).filter((w) => statuses[w] === "correct"),
              incorrect: Object.keys(statuses).filter((w) => statuses[w] === "incorrect"),
              notAnswered: words.filter((w) => statuses[w] !== "correct" && statuses[w] !== "incorrect"),
            }}
            jumpToWord={jumpToWord}
          />
        )
      )}

      <footer>
        <p>
          Tip: Edit <b>public/cwords.txt</b> (one word per line). Shortcuts — <b>C</b> ✓,
          <b> X</b> ✗, <b>S</b> skip, <b>Space/→</b> next.
        </p>
      </footer>
    </div>
  );
}

/** ----- Views ----- */
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
        <button onClick={() => onMark("correct")} className="btn">✓ Correct</button>
        <button onClick={() => onMark("incorrect")} className="btn">✗ Incorrect</button>
        <button onClick={() => onMark("skipped")} className="btn">Skip</button>
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
