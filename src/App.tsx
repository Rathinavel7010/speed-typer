import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { WORDS } from "./words";

type Mode = "time" | "words";
type TimerOption = 15 | 30 | 60 | 120;
type WordOption = 10 | 25 | 50 | 100;
type Phase = "idle" | "running" | "finished";

const TIME_OPTIONS: TimerOption[] = [15, 30, 60, 120];
const WORD_OPTIONS: WordOption[] = [10, 25, 50, 100];

interface CharState {
  char: string;
  state: "untyped" | "correct" | "incorrect" | "extra";
}

interface WordState {
  chars: CharState[];
  state: "untyped" | "current" | "typed" | "wrong";
}

function generateWords(count: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
  }
  return result;
}

function buildWordStates(words: string[]): WordState[] {
  return words.map((w) => ({
    chars: w.split("").map((c) => ({ char: c, state: "untyped" as const })),
    state: "untyped" as const,
  }));
}

export default function App() {
  const [mode, setMode] = useState<Mode>("time");
  const [timeOption, setTimeOption] = useState<TimerOption>(30);
  const [wordOption, setWordOption] = useState<WordOption>(25);

  const [wordStates, setWordStates] = useState<WordState[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);

  const [phase, setPhase] = useState<Phase>("idle");
  const [timeLeft, setTimeLeft] = useState<TimerOption>(30);
  const [liveWpm, setLiveWpm] = useState(0);
  const [liveAccuracy, setLiveAccuracy] = useState(100);
  const [showResult, setShowResult] = useState(false);
  const [confetti, setConfetti] = useState<
    { id: number; left: number; delay: number; color: string; duration: number }[]
  >([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastKeyRef = useRef<string | null>(null);

  const [totalKeystrokes, setTotalKeystrokes] = useState(0);
  const [totalErrors, setTotalErrors] = useState(0);
  const [finalWpm, setFinalWpm] = useState(0);
  const [finalAccuracy, setFinalAccuracy] = useState(100);
  const [finalTime, setFinalTime] = useState(0);

  const initTest = useCallback(() => {
    let count: number;
    if (mode === "time") {
      count = 80;
    } else {
      count = wordOption;
    }
    const words = generateWords(count);
    setWordStates(buildWordStates(words));
    setCurrentWordIndex(0);
    setCurrentCharIndex(0);
    setTimeLeft(timeOption);
    setLiveWpm(0);
    setLiveAccuracy(100);
    setShowResult(false);
    setConfetti([]);
    setTotalKeystrokes(0);
    setTotalErrors(0);
    setFinalWpm(0);
    setFinalAccuracy(100);
    setFinalTime(0);
    setPhase("idle");
    startTimeRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [mode, timeOption, wordOption]);

  useEffect(() => {
    initTest();
  }, [initTest]);

  useEffect(() => {
    if (phase !== "running" || !startTimeRef.current) return;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current!) / 1000 / 60;
      let correctChars = 0;
      wordStates.forEach((w) => {
        w.chars.forEach((c) => {
          if (c.state === "correct") correctChars++;
        });
      });
      if (elapsed > 0) {
        const wpm = Math.round((correctChars / 5) / elapsed);
        setLiveWpm(wpm);
      }
      if (totalKeystrokes > 0) {
        setLiveAccuracy(
          Math.max(0, Math.round(((totalKeystrokes - totalErrors) / totalKeystrokes) * 100))
        );
      }
    }, 100);
    return () => clearInterval(interval);
  }, [phase, wordStates, totalKeystrokes, totalErrors]);

  useEffect(() => {
    if (phase !== "running" || mode !== "time") return;
    timerRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          finishTest();
          return 0 as TimerOption;
        }
        return (t - 1) as TimerOption;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode]);

  const finishTest = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPhase("finished");
    setShowResult(true);
    const elapsed = startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 0;
    let correctChars = 0;
    wordStates.forEach((w) => {
      w.chars.forEach((c) => {
        if (c.state === "correct") correctChars++;
      });
    });
    const minutes = elapsed / 60;
    const wpm = minutes > 0 ? Math.round((correctChars / 5) / minutes) : 0;
    const acc =
      totalKeystrokes > 0
        ? Math.round(((totalKeystrokes - totalErrors) / totalKeystrokes) * 100)
        : 100;
    setFinalWpm(wpm);
    setFinalAccuracy(acc);
    setFinalTime(Math.round(elapsed));
    launchConfetti();
  }, [wordStates, totalKeystrokes, totalErrors]);

  useEffect(() => {
    if (phase !== "running" || mode !== "words") return;
    const word = wordStates[currentWordIndex];
    if (
      word &&
      currentCharIndex >= word.chars.length &&
      word.chars.every((c) => c.state === "correct")
    ) {
      if (currentWordIndex >= wordOption - 1) {
        setTimeout(() => finishTest(), 100);
      }
    }
  }, [currentCharIndex, currentWordIndex, phase, mode, wordOption, wordStates, finishTest]);

  const launchConfetti = () => {
    const colors = ["#ff006e", "#8338ec", "#3a86ff", "#06ffa5", "#ffbe0b", "#fb5607"];
    const pieces = Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: 2.5 + Math.random() * 2,
    }));
    setConfetti(pieces);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (phase === "finished") return;
    if (phase === "idle") {
      setPhase("running");
      startTimeRef.current = Date.now();
    }

    const key = e.key;
    lastKeyRef.current = key;

    if (key === "Tab") {
      e.preventDefault();
      initTest();
      return;
    }

    if (key === "Backspace") {
      e.preventDefault();
      handleBackspace();
      return;
    }

    if (key === " ") {
      e.preventDefault();
      handleSpace();
      return;
    }

    if (key.length !== 1) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    e.preventDefault();
    handleCharacter(key);
  };

  const handleCharacter = (char: string) => {
    setTotalKeystrokes((k) => k + 1);

    setWordStates((prev) => {
      const next = prev.map((w) => ({ ...w, chars: w.chars.map((c) => ({ ...c })) }));
      const word = next[currentWordIndex];
      if (!word) return prev;

      if (currentCharIndex < word.chars.length) {
        const expected = word.chars[currentCharIndex].char;
        if (char === expected) {
          word.chars[currentCharIndex].state = "correct";
        } else {
          word.chars[currentCharIndex].state = "incorrect";
          setTotalErrors((e) => e + 1);
        }
      } else {
        word.chars.push({ char, state: "extra" });
        setTotalErrors((e) => e + 1);
      }
      return next;
    });

    setCurrentCharIndex((i) => i + 1);
  };

  const handleBackspace = () => {
    if (currentCharIndex === 0 && currentWordIndex === 0) return;

    setWordStates((prev) => {
      const next = prev.map((w) => ({ ...w, chars: w.chars.map((c) => ({ ...c })) }));
      const word = next[currentWordIndex];
      if (!word) return prev;

      if (currentCharIndex > 0) {
        const idx = currentCharIndex - 1;
        const c = word.chars[idx];
        if (c.state === "extra") {
          word.chars.pop();
        } else {
          c.state = "untyped";
        }
      }
      return next;
    });

    if (currentCharIndex > 0) {
      setCurrentCharIndex((i) => i - 1);
    } else {
      const prevIdx = currentWordIndex - 1;
      if (prevIdx >= 0) {
        setCurrentWordIndex(prevIdx);
        setCurrentCharIndex(wordStates[prevIdx].chars.length);
      }
    }
  };

  const handleSpace = () => {
    const word = wordStates[currentWordIndex];
    if (!word) return;

    setWordStates((prev) => {
      const next = prev.map((w) => ({ ...w, chars: w.chars.map((c) => ({ ...c })) }));
      const w = next[currentWordIndex];
      if (w.chars.every((c) => c.state === "correct")) {
        w.state = "typed";
      } else {
        w.state = "wrong";
      }
      return next;
    });

    if (mode === "time") {
      setCurrentWordIndex((i) => i + 1);
      setCurrentCharIndex(0);
    } else {
      if (currentWordIndex < wordOption - 1) {
        setCurrentWordIndex((i) => i + 1);
        setCurrentCharIndex(0);
      } else {
        setCurrentCharIndex((i) => i + 1);
      }
    }
  };

  const restart = () => {
    initTest();
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  const visibleFrom = Math.max(0, currentWordIndex - 1);
  const visibleWords = wordStates.slice(visibleFrom, visibleFrom + 25);

  const progress = useMemo(() => {
    if (mode === "time") {
      return ((timeOption - timeLeft) / timeOption) * 100;
    } else {
      return (currentWordIndex / wordOption) * 100;
    }
  }, [mode, timeOption, timeLeft, currentWordIndex, wordOption]);

  const currentKey = phase === "running" ? lastKeyRef.current : null;

  return (
    <>
      <div className="aurora-bg" aria-hidden>
        <div className="aurora-blob b1" />
        <div className="aurora-blob b2" />
        <div className="aurora-blob b3" />
        <div className="aurora-blob b4" />
        <div className="aurora-blob b5" />
      </div>
      <div className="grid-bg" aria-hidden />

      {confetti.map((c) => (
        <div
          key={c.id}
          className="confetti-piece"
          style={{
            left: `${c.left}%`,
            background: c.color,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.duration}s`,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}

      <div className="relative min-h-screen flex flex-col items-center px-4 py-8 sm:py-12">
        <header className="w-full max-w-5xl flex items-center justify-between mb-8 sm:mb-12 fade-up">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold gradient-text leading-none">
                Speed Typer
              </h1>
              <p className="text-[10px] sm:text-xs text-white/40 mt-0.5">Test your typing speed</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2 text-white/40 text-xs">
              <kbd className="px-2 py-1 rounded bg-white/5 border border-white/10 font-mono">Tab</kbd>
              <span>restart</span>
            </div>
            <button
              onClick={restart}
              className="hover-lift glass px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
              title="Restart test"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-4 h-4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
              <span className="hidden sm:inline">Restart</span>
            </button>
          </div>
        </header>

        <main className="w-full max-w-5xl flex-1 flex flex-col items-center">
          <div className="glass rounded-2xl p-3 sm:p-4 mb-6 sm:mb-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4 fade-up">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-black/20">
              <button
                onClick={() => setMode("time")}
                className={`mode-pill ${mode === "time" ? "active" : ""}`}
              >
                ⏱ time
              </button>
              <button
                onClick={() => setMode("words")}
                className={`mode-pill ${mode === "words" ? "active" : ""}`}
              >
                📝 words
              </button>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-black/20">
              {(mode === "time" ? TIME_OPTIONS : WORD_OPTIONS).map((opt) => (
                <button
                  key={opt}
                  onClick={() =>
                    mode === "time"
                      ? setTimeOption(opt as TimerOption)
                      : setWordOption(opt as WordOption)
                  }
                  className={`option-pill ${
                    (mode === "time" ? timeOption === opt : wordOption === opt) ? "active" : ""
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full max-w-3xl grid grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
            <StatBox
              label={mode === "time" ? "Time" : "Words"}
              value={mode === "time" ? `${timeLeft}s` : `${currentWordIndex}/${wordOption}`}
              color={mode === "time" && timeLeft <= 5 ? "#ff006e" : "#3a86ff"}
              pulse={phase === "running"}
            />
            <StatBox
              label="WPM"
              value={String(liveWpm)}
              color="#06ffa5"
              pulse={phase === "running"}
            />
            <StatBox
              label="Accuracy"
              value={`${liveAccuracy}%`}
              color="#ffbe0b"
              pulse={phase === "running"}
            />
          </div>

          <div className="w-full max-w-3xl h-1.5 bg-white/5 rounded-full overflow-hidden mb-8">
            <div className="bar-fill" style={{ width: `${progress}%` }} />
          </div>

          <div
            ref={containerRef}
            onClick={handleContainerClick}
            className="glass rounded-2xl p-6 sm:p-10 w-full max-w-3xl min-h-[200px] sm:min-h-[240px] cursor-text relative fade-up"
            style={{ animationDelay: "0.2s" }}
          >
            {phase === "idle" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="flex items-center gap-2 text-white/40 text-sm sm:text-base animate-pulse">
                  <span>⌨️</span>
                  <span>Click here or start typing to begin</span>
                </div>
              </div>
            )}

            <div className="font-mono text-xl sm:text-2xl leading-relaxed tracking-wide select-none break-words">
              {visibleWords.map((word, vi) => {
                const realIndex = visibleFrom + vi;
                const isCurrent = realIndex === currentWordIndex;
                return (
                  <span
                    key={realIndex}
                    className={`word ${
                      isCurrent
                        ? "current"
                        : word.state === "typed"
                        ? "typed"
                        : word.state === "wrong"
                        ? "wrong"
                        : "untyped"
                    }`}
                  >
                    {word.chars.map((c, ci) => {
                      const showCaret = isCurrent && ci === currentCharIndex;
                      return (
                        <span key={ci} className="char-wrap relative">
                          {showCaret && phase !== "finished" && <span className="caret" />}
                          <span
                            className={`char ${
                              c.state === "correct"
                                ? "correct"
                                : c.state === "incorrect"
                                ? "incorrect"
                                : c.state === "extra"
                                ? "incorrect"
                                : "untyped"
                            }`}
                          >
                            {c.char}
                          </span>
                        </span>
                      );
                    })}
                    {isCurrent &&
                      currentCharIndex === word.chars.length &&
                      phase !== "finished" && <span className="caret" />}
                  </span>
                );
              })}
              {phase !== "finished" &&
                currentWordIndex >= visibleFrom + visibleWords.length - 5 &&
                wordStates.length > visibleFrom + visibleWords.length && (
                  <span className="text-white/30 animate-pulse">...</span>
                )}
            </div>

            <input
              ref={inputRef}
              type="text"
              className="absolute opacity-0 pointer-events-none"
              onKeyDown={handleKeyDown}
              onBlur={() => {
                if (phase === "running") inputRef.current?.focus();
              }}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>

          <Keyboard currentKey={currentKey} />

          <p className="mt-8 text-white/30 text-xs sm:text-sm text-center max-w-md">
            💡 Tip: accuracy matters as much as speed. Focus on clean typing, then push the pace.
          </p>
        </main>

        {showResult && (
          <ResultModal
            wpm={finalWpm}
            accuracy={finalAccuracy}
            time={finalTime}
            mode={mode}
            onRestart={restart}
            onClose={() => setShowResult(false)}
          />
        )}

        <footer className="w-full max-w-5xl mt-12 text-center text-white/30 text-xs">
          <p>Built with love · Train daily, type fast</p>
        </footer>
      </div>
    </>
  );
}

function StatBox({
  label,
  value,
  color,
  pulse,
}: {
  label: string;
  value: string;
  color: string;
  pulse: boolean;
}) {
  return (
    <div className={`glass rounded-xl p-3 sm:p-4 ${pulse ? "pulse-ring" : ""}`}>
      <div className="text-[10px] sm:text-xs uppercase tracking-wider text-white/40 font-semibold">
        {label}
      </div>
      <div
        className="text-lg sm:text-2xl font-bold stat-glow leading-tight mt-1"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}

function Keyboard({ currentKey }: { currentKey: string | null }) {
  const rows: string[][] = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["z", "x", "c", "v", "b", "n", "m"],
  ];

  const active = currentKey?.toLowerCase() ?? "";

  return (
    <div className="mt-8 hidden md:flex flex-col items-center gap-1.5 select-none">
      {rows.map((row, ri) => (
        <div
          key={ri}
          className="flex gap-1.5"
          style={{ marginLeft: ri === 1 ? 20 : ri === 2 ? 50 : 0 }}
        >
          {row.map((k) => (
            <div
              key={k}
              className={`w-9 h-9 rounded-md flex items-center justify-center font-mono text-sm font-semibold transition-all duration-100 ${
                active === k
                  ? "key-active"
                  : "bg-white/5 text-white/40 border border-white/5"
              }`}
            >
              {k.toUpperCase()}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ResultModal({
  wpm,
  accuracy,
  time,
  mode,
  onRestart,
  onClose,
}: {
  wpm: number;
  accuracy: number;
  time: number;
  mode: Mode;
  onRestart: () => void;
  onClose: () => void;
}) {
  const grade = wpm >= 80 ? "Master" : wpm >= 60 ? "Expert" : wpm >= 40 ? "Pro" : wpm >= 25 ? "Average" : "Beginner";
  const gradeColor =
    wpm >= 80 ? "#06ffa5" : wpm >= 60 ? "#3a86ff" : wpm >= 40 ? "#8338ec" : wpm >= 25 ? "#ffbe0b" : "#ff006e";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass rounded-3xl p-6 sm:p-10 max-w-md w-full scale-in relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 opacity-20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-gradient-to-br from-blue-500 to-green-400 opacity-20 blur-3xl" />

        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-xs uppercase tracking-widest text-white/40 mb-1">Test Complete</div>
              <div className="text-2xl font-bold gradient-text">{grade}</div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition"
              title="Close"
            >
              ✕
            </button>
          </div>

          <div className="text-center my-6">
            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
              Words per minute
            </div>
            <div
              className="text-7xl font-black stat-glow leading-none"
              style={{ color: gradeColor }}
            >
              {wpm}
            </div>
            <div className="text-sm text-white/50 mt-1">WPM</div>
          </div>

          <div className="grid grid-cols-2 gap-3 my-6">
            <div className="bg-black/20 rounded-xl p-4 text-center">
              <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Accuracy</div>
              <div
                className="text-2xl font-bold"
                style={{ color: accuracy >= 95 ? "#06ffa5" : accuracy >= 85 ? "#ffbe0b" : "#ff006e" }}
              >
                {accuracy}%
              </div>
            </div>
            <div className="bg-black/20 rounded-xl p-4 text-center">
              <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Time</div>
              <div className="text-2xl font-bold text-white/80">{time}s</div>
            </div>
          </div>

          <div className="text-xs text-white/40 text-center mb-4">
            Mode: <span className="text-white/70 font-semibold capitalize">{mode}</span>
          </div>

          <button
            onClick={onRestart}
            className="w-full py-3.5 rounded-xl font-bold text-base text-black bg-gradient-to-r from-green-400 via-cyan-400 to-blue-500 hover:from-green-300 hover:to-blue-400 transition-all shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2"
          >
            ↻ Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
