import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Flag,
  Gauge,
  List,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { deletePractice, getPractice, getPractices, savePractice } from "./db";
import { parseSubtitleFile } from "./subtitles";
import type { Practice, Segment } from "./types";
import { extractYouTubeVideoId } from "./youtube";

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        options: {
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: () => void;
            onError?: () => void;
          };
        },
      ) => YouTubePlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YouTubePlayer = {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  setPlaybackRate: (rate: number) => void;
  getCurrentTime: () => number;
  destroy: () => void;
};

type Screen =
  | { name: "home" }
  | { name: "new" }
  | { name: "practice"; practiceId: string };

const slowRate = 0.75;

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [practices, setPractices] = useState<Practice[]>([]);
  const [activePractice, setActivePractice] = useState<Practice | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadPractices = useCallback(async () => {
    const saved = await getPractices();
    setPractices(saved);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadPractices();
  }, [loadPractices]);

  useEffect(() => {
    if (screen.name !== "practice") {
      setActivePractice(null);
      return;
    }

    let isMounted = true;
    void getPractice(screen.practiceId).then(async (practice) => {
      if (!practice || !isMounted) return;
      const openedPractice = { ...practice, lastOpenedAt: new Date().toISOString() };
      setActivePractice(openedPractice);
      await savePractice(openedPractice);
      await loadPractices();
    });

    return () => {
      isMounted = false;
    };
  }, [loadPractices, screen]);

  const openHome = async () => {
    setScreen({ name: "home" });
    await loadPractices();
  };

  const handlePracticeChange = async (nextPractice: Practice) => {
    setActivePractice(nextPractice);
    await savePractice(nextPractice);
    await loadPractices();
  };

  return (
    <main className="app-shell">
      {screen.name === "home" && (
        <HomeScreen
          isLoading={isLoading}
          practices={practices}
          onNew={() => setScreen({ name: "new" })}
          onOpen={(practiceId) => setScreen({ name: "practice", practiceId })}
          onDelete={async (practiceId) => {
            await deletePractice(practiceId);
            await loadPractices();
          }}
        />
      )}

      {screen.name === "new" && (
        <NewPracticeScreen
          onBack={openHome}
          onCreated={async (practice) => {
            await savePractice(practice);
            await loadPractices();
            setScreen({ name: "practice", practiceId: practice.id });
          }}
        />
      )}

      {screen.name === "practice" && activePractice && (
        <PracticeScreen practice={activePractice} onBack={openHome} onChange={handlePracticeChange} />
      )}
    </main>
  );
}

function HomeScreen({
  isLoading,
  practices,
  onNew,
  onOpen,
  onDelete,
}: {
  isLoading: boolean;
  practices: Practice[];
  onNew: () => void;
  onOpen: (practiceId: string) => void;
  onDelete: (practiceId: string) => void;
}) {
  return (
    <section className="screen home-screen">
      <header className="topbar">
        <div>
          <p className="eyebrow">Mobile listening practice</p>
          <h1>ListenWrite English</h1>
        </div>
        <button className="icon-button primary" onClick={onNew} aria-label="New Practice" title="New Practice">
          <Plus size={22} />
        </button>
      </header>

      <button className="wide-action" onClick={onNew}>
        <Plus size={20} />
        New Practice
      </button>

      <div className="practice-list">
        <h2>Saved Practices</h2>
        {isLoading && <p className="muted">Loading...</p>}
        {!isLoading && practices.length === 0 && (
          <div className="empty-state">
            <FileText size={32} />
            <p>No practices yet.</p>
          </div>
        )}

        {practices.map((practice) => {
          const completed = getCompletedCount(practice.segments);
          const percent = getProgressPercent(practice.segments);
          return (
            <article className="practice-card" key={practice.id}>
              <button className="practice-main" onClick={() => onOpen(practice.id)}>
                <strong>{practice.title}</strong>
                <span>{practice.youtubeVideoId}</span>
                <div className="meta-row">
                  <span>{practice.segments.length} segments</span>
                  <span>{completed} completed</span>
                  <span>{formatDate(practice.lastOpenedAt)}</span>
                </div>
                <div className="progress-track" aria-label={`Completed ${percent}%`}>
                  <div style={{ width: `${percent}%` }} />
                </div>
              </button>
              <button
                className="icon-button danger"
                onClick={() => onDelete(practice.id)}
                aria-label="Delete practice"
                title="Delete practice"
              >
                <Trash2 size={18} />
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function NewPracticeScreen({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: (practice: Practice) => void;
}) {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError("");
    setFile(event.target.files?.[0] ?? null);
  };

  const createPractice = async () => {
    setError("");
    const videoId = extractYouTubeVideoId(youtubeUrl);

    if (!videoId) {
      setError("Please enter a valid YouTube link.");
      return;
    }

    if (!file) {
      setError("Please upload an Arabic subtitle file.");
      return;
    }

    if (!/\.(srt|vtt)$/i.test(file.name)) {
      setError("Please upload an SRT or VTT file.");
      return;
    }

    setIsCreating(true);
    try {
      const content = await file.text();
      const segments = parseSubtitleFile(content);

      if (segments.length === 0) {
        setError("No subtitle segments were found.");
        return;
      }

      const now = new Date().toISOString();
      onCreated({
        id: `practice_${crypto.randomUUID()}`,
        title: file.name.replace(/\.(srt|vtt)$/i, "") || "YouTube Practice",
        youtubeUrl,
        youtubeVideoId: videoId,
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
        currentSegmentIndex: 0,
        segments,
      });
    } catch {
      setError("The subtitle file is not valid. Please upload a valid SRT or VTT file.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <section className="screen form-screen">
      <header className="topbar">
        <button className="icon-button" onClick={onBack} aria-label="Back" title="Back">
          <ArrowLeft size={21} />
        </button>
        <h1>New Practice</h1>
      </header>

      <div className="form-stack">
        <label>
          <span>YouTube Link</span>
          <input
            value={youtubeUrl}
            onChange={(event) => setYoutubeUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
            inputMode="url"
          />
        </label>

        <label className="file-picker">
          <span>Upload Arabic Subtitle</span>
          <input accept=".srt,.vtt,text/vtt" type="file" onChange={handleFileChange} />
          <div>
            <Upload size={18} />
            {file ? file.name : "Choose SRT or VTT file"}
          </div>
        </label>

        {error && <p className="error-message">{error}</p>}

        <button className="wide-action" onClick={createPractice} disabled={isCreating}>
          <Check size={20} />
          {isCreating ? "Creating..." : "Create Practice"}
        </button>
      </div>
    </section>
  );
}

function PracticeScreen({
  practice,
  onBack,
  onChange,
}: {
  practice: Practice;
  onBack: () => void;
  onChange: (practice: Practice) => void;
}) {
  const currentSegment = practice.segments[practice.currentSegmentIndex];
  const completed = getCompletedCount(practice.segments);
  const percent = getProgressPercent(practice.segments);
  const [showSegments, setShowSegments] = useState(false);

  const updateCurrentSegment = (updater: (segment: Segment) => Segment) => {
    const segments = practice.segments.map((segment, index) =>
      index === practice.currentSegmentIndex ? updater(segment) : segment,
    );
    onChange({ ...practice, segments });
  };

  const moveTo = (index: number) => {
    if (index < 0 || index >= practice.segments.length) return;
    const segments = practice.segments.map((segment, segmentIndex) =>
      segmentIndex === practice.currentSegmentIndex && segment.userAnswer.trim()
        ? { ...segment, isCompleted: true }
        : segment,
    );
    onChange({ ...practice, currentSegmentIndex: index, segments });
  };

  return (
    <section className="screen practice-screen">
      <header className="practice-header">
        <button className="icon-button" onClick={onBack} aria-label="Back" title="Back">
          <ArrowLeft size={21} />
        </button>
        <div>
          <strong>Segment {practice.currentSegmentIndex + 1} of {practice.segments.length}</strong>
          <span>Completed: {percent}%</span>
        </div>
        <button
          className="icon-button"
          onClick={() => setShowSegments((value) => !value)}
          aria-label="Segments"
          title="Segments"
        >
          <List size={21} />
        </button>
      </header>

      <YouTubeSegmentPlayer videoId={practice.youtubeVideoId} segment={currentSegment} onReplay={() => {
        updateCurrentSegment((segment) => ({ ...segment, replayCount: segment.replayCount + 1 }));
      }} />

      <div className="progress-summary">
        <span>{completed} completed</span>
        <span>{currentSegment.replayCount} replays</span>
      </div>

      <section className="subtitle-band" dir="rtl">
        {currentSegment.arabicText}
      </section>

      <label className="answer-box">
        <span>Write the English sentence you hear</span>
        <textarea
          value={currentSegment.userAnswer}
          onChange={(event) => updateCurrentSegment((segment) => ({ ...segment, userAnswer: event.target.value }))}
          onBlur={() => {
            if (currentSegment.userAnswer.trim()) {
              updateCurrentSegment((segment) => ({ ...segment, isCompleted: true }));
            }
          }}
          placeholder="Write the English sentence you hear..."
        />
      </label>

      <div className="nav-grid">
        <button onClick={() => moveTo(practice.currentSegmentIndex - 1)} disabled={practice.currentSegmentIndex === 0}>
          <ChevronLeft size={20} />
          Previous
        </button>
        <button onClick={() => moveTo(practice.currentSegmentIndex + 1)} disabled={practice.currentSegmentIndex === practice.segments.length - 1}>
          Next
          <ChevronRight size={20} />
        </button>
      </div>

      <button
        className={currentSegment.isDifficult ? "wide-action warning active" : "wide-action warning"}
        onClick={() => updateCurrentSegment((segment) => ({ ...segment, isDifficult: !segment.isDifficult }))}
      >
        <Flag size={19} />
        {currentSegment.isDifficult ? "Marked Difficult" : "Mark as Difficult"}
      </button>

      {showSegments && (
        <SegmentDrawer
          practice={practice}
          onClose={() => setShowSegments(false)}
          onSelect={(index) => {
            moveTo(index);
            setShowSegments(false);
          }}
        />
      )}
    </section>
  );
}

function YouTubeSegmentPlayer({
  videoId,
  segment,
  onReplay,
}: {
  videoId: string;
  segment: Segment;
  onReplay: () => void;
}) {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const timerRef = useRef<number | null>(null);
  const elementId = useMemo(() => `youtube-player-${videoId}`, [videoId]);
  const [isReady, setIsReady] = useState(false);
  const [playerError, setPlayerError] = useState("");

  useEffect(() => {
    let isMounted = true;

    loadYouTubeApi()
      .then(() => {
        if (!isMounted || !window.YT) return;
        playerRef.current = new window.YT.Player(elementId, {
          videoId,
          playerVars: {
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: () => setIsReady(true),
            onError: () => setPlayerError("The YouTube video cannot be loaded. Please check the link."),
          },
        });
      })
      .catch(() => setPlayerError("The YouTube video cannot be loaded. Please check the link."));

    return () => {
      isMounted = false;
      stopEndTimer();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [elementId, videoId]);

  const stopEndTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const playSegment = (rate: number) => {
    const player = playerRef.current;
    if (!player) return;
    stopEndTimer();
    player.setPlaybackRate(rate);
    player.seekTo(segment.startTime, true);
    player.playVideo();
    timerRef.current = window.setInterval(() => {
      const currentTime = player.getCurrentTime();
      if (currentTime >= segment.endTime || currentTime < segment.startTime - 0.5) {
        player.pauseVideo();
        stopEndTimer();
      }
    }, 80);
  };

  return (
    <section className="player-section">
      <div className="video-frame">
        <div id={elementId} />
      </div>
      {playerError && <p className="error-message">{playerError}</p>}
      <div className="control-row">
        <button onClick={() => playSegment(1)} disabled={!isReady} title="Play">
          <Play size={20} />
          Play
        </button>
        <button
          className="replay-button"
          onClick={() => {
            onReplay();
            playSegment(1);
          }}
          disabled={!isReady}
          title="Replay"
        >
          <RefreshCcw size={21} />
          Replay
        </button>
        <button onClick={() => playSegment(slowRate)} disabled={!isReady} title="Play Slow">
          <Gauge size={20} />
          Slow
        </button>
        <button
          onClick={() => {
            playerRef.current?.pauseVideo();
            stopEndTimer();
          }}
          disabled={!isReady}
          aria-label="Pause"
          title="Pause"
        >
          <Pause size={20} />
        </button>
      </div>
    </section>
  );
}

function SegmentDrawer({
  practice,
  onClose,
  onSelect,
}: {
  practice: Practice;
  onClose: () => void;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="segment-drawer" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>Segments</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close" title="Close">
            <ArrowLeft size={20} />
          </button>
        </header>
        <div className="segment-list">
          {practice.segments.map((segment) => (
            <button
              key={segment.id}
              className={segment.index === practice.currentSegmentIndex ? "segment-row active" : "segment-row"}
              onClick={() => onSelect(segment.index)}
            >
              <span>{segment.index + 1}</span>
              <div>
                <small>{formatTimeRange(segment.startTime, segment.endTime)}</small>
                <b dir="rtl">{segment.arabicText}</b>
              </div>
              <em>
                {segment.isCompleted && <Check size={15} />}
                {segment.isDifficult && <Flag size={14} />}
              </em>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>("script[src='https://www.youtube.com/iframe_api']");
    window.onYouTubeIframeAPIReady = () => resolve();

    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(script);
    }
  });
}

function getCompletedCount(segments: Segment[]): number {
  return segments.filter((segment) => segment.isCompleted || segment.userAnswer.trim()).length;
}

function getProgressPercent(segments: Segment[]): number {
  if (segments.length === 0) return 0;
  return Math.round((getCompletedCount(segments) / segments.length) * 100);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTimeRange(startTime: number, endTime: number): string {
  return `${formatTimestamp(startTime)} - ${formatTimestamp(endTime)}`;
}

function formatTimestamp(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${padTime(minutes)}:${padTime(remainingSeconds)}`;
  }

  return `${minutes}:${padTime(remainingSeconds)}`;
}

function padTime(value: number): string {
  return value.toString().padStart(2, "0");
}
