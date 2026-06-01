import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Captions,
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
            onStateChange?: (event: { data: number }) => void;
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
  getDuration: () => number;
  loadModule: (moduleName: string) => void;
  unloadModule: (moduleName: string) => void;
  destroy: () => void;
};

const youtubePlayerState = {
  playing: 1,
  paused: 2,
  buffering: 3,
} as const;

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
  const [appError, setAppError] = useState("");

  const loadPractices = useCallback(async () => {
    try {
      setAppError("");
      const saved = await getPractices();
      setPractices(saved);
    } catch {
      setAppError("Database is not ready. Please run the Supabase schema SQL and check the public policies.");
    } finally {
      setIsLoading(false);
    }
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
    void getPractice(screen.practiceId)
      .then(async (practice) => {
        if (!practice || !isMounted) return;
        const openedPractice = { ...practice, lastOpenedAt: new Date().toISOString() };
        setActivePractice(openedPractice);
        await savePractice(openedPractice);
        await loadPractices();
      })
      .catch(() => setAppError("Database is not ready. Please run the Supabase schema SQL and check the public policies."));

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
    try {
      await savePractice(nextPractice);
      await loadPractices();
    } catch {
      setAppError("Could not save progress. Please check the Supabase table policies.");
    }
  };

  return (
    <main className="app-shell">
      {screen.name === "home" && (
        <HomeScreen
          isLoading={isLoading}
          practices={practices}
          error={appError}
          onNew={() => setScreen({ name: "new" })}
          onOpen={(practiceId) => setScreen({ name: "practice", practiceId })}
          onDelete={async (practiceId) => {
            try {
              await deletePractice(practiceId);
              await loadPractices();
            } catch {
              setAppError("Could not delete the practice. Please check the Supabase table policies.");
            }
          }}
        />
      )}

      {screen.name === "new" && (
        <NewPracticeScreen
          onBack={openHome}
          onCreated={async (practice) => {
            try {
              await savePractice(practice);
              await loadPractices();
              setScreen({ name: "practice", practiceId: practice.id });
            } catch {
              setAppError("Could not save the practice. Please check the Supabase table policies.");
              setScreen({ name: "home" });
            }
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
  error,
}: {
  isLoading: boolean;
  practices: Practice[];
  onNew: () => void;
  onOpen: (practiceId: string) => void;
  onDelete: (practiceId: string) => void;
  error: string;
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
        {error && <p className="error-message">{error}</p>}
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
  onCreated: (practice: Practice) => Promise<void>;
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
      await onCreated({
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
  const [autoPlayRequest, setAutoPlayRequest] = useState(0);

  const updateCurrentSegment = (updater: (segment: Segment) => Segment) => {
    const segments = practice.segments.map((segment, index) =>
      index === practice.currentSegmentIndex ? updater(segment) : segment,
    );
    onChange({ ...practice, segments });
  };

  const moveTo = (index: number, shouldAutoPlay = false) => {
    if (index < 0 || index >= practice.segments.length) return;
    const segments = practice.segments.map((segment, segmentIndex) =>
      segmentIndex === practice.currentSegmentIndex && segment.userAnswer.trim()
        ? { ...segment, isCompleted: true }
        : segment,
    );
    onChange({ ...practice, currentSegmentIndex: index, segments });
    if (shouldAutoPlay) {
      setAutoPlayRequest((value) => value + 1);
    }
  };

  const syncSegmentToVideoTime = useCallback(
    (time: number) => {
      const current = practice.segments[practice.currentSegmentIndex];
      if (time >= current.startTime && time < current.endTime) return;

      const matchingIndex = practice.segments.findIndex(
        (segment) => time >= segment.startTime && time < segment.endTime,
      );

      if (matchingIndex >= 0 && matchingIndex !== practice.currentSegmentIndex) {
        onChange({ ...practice, currentSegmentIndex: matchingIndex });
      }
    },
    [onChange, practice],
  );

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

      <YouTubeSegmentPlayer
        videoId={practice.youtubeVideoId}
        segment={currentSegment}
        autoPlayRequest={autoPlayRequest}
        onVideoTimeChange={syncSegmentToVideoTime}
        onReplay={() => {
          updateCurrentSegment((segment) => ({ ...segment, replayCount: segment.replayCount + 1 }));
        }}
      />

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

      <div className="practice-actions">
        <div className="nav-grid">
          <button onClick={() => moveTo(practice.currentSegmentIndex - 1, true)} disabled={practice.currentSegmentIndex === 0}>
            <ChevronLeft size={20} />
            Previous
          </button>
          <button onClick={() => moveTo(practice.currentSegmentIndex + 1, true)} disabled={practice.currentSegmentIndex === practice.segments.length - 1}>
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
      </div>

      {showSegments && (
        <SegmentDrawer
          practice={practice}
          onClose={() => setShowSegments(false)}
          onSelect={(index) => {
            moveTo(index, true);
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
  autoPlayRequest,
  onVideoTimeChange,
  onReplay,
}: {
  videoId: string;
  segment: Segment;
  autoPlayRequest: number;
  onVideoTimeChange: (time: number) => void;
  onReplay: () => void;
}) {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const timerRef = useRef<number | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const onVideoTimeChangeRef = useRef(onVideoTimeChange);
  const elementId = useMemo(() => `youtube-player-${videoId}`, [videoId]);
  const [isReady, setIsReady] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const [activePlaybackRate, setActivePlaybackRate] = useState<number | null>(null);
  const [showYouTubeCaptions, setShowYouTubeCaptions] = useState(false);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  useEffect(() => {
    onVideoTimeChangeRef.current = onVideoTimeChange;
  }, [onVideoTimeChange]);

  const stopEndTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopSyncTimer = useCallback(() => {
    if (syncTimerRef.current) {
      window.clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
  }, []);

  const startSyncTimer = useCallback(() => {
    stopSyncTimer();
    syncTimerRef.current = window.setInterval(() => {
      const currentTime = playerRef.current?.getCurrentTime();
      if (typeof currentTime === "number") {
        setCurrentVideoTime(currentTime);
        onVideoTimeChangeRef.current(currentTime);
      }

      const duration = playerRef.current?.getDuration();
      if (typeof duration === "number" && Number.isFinite(duration) && duration > 0) {
        setVideoDuration(duration);
      }
    }, 350);
  }, [stopSyncTimer]);

  useEffect(() => {
    let isMounted = true;

    loadYouTubeApi()
      .then(() => {
        if (!isMounted || !window.YT) return;
        playerRef.current = new window.YT.Player(elementId, {
          videoId,
          playerVars: {
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: () => {
              setIsReady(true);
              const duration = playerRef.current?.getDuration();
              if (typeof duration === "number" && Number.isFinite(duration)) {
                setVideoDuration(duration);
              }
            },
            onError: () => setPlayerError("The YouTube video cannot be loaded. Please check the link."),
            onStateChange: (event) => {
              if (event.data === youtubePlayerState.playing || event.data === youtubePlayerState.buffering) {
                startSyncTimer();
              }

              if (event.data === youtubePlayerState.paused) {
                stopSyncTimer();
              }
            },
          },
        });
      })
      .catch(() => setPlayerError("The YouTube video cannot be loaded. Please check the link."));

    return () => {
      isMounted = false;
      stopEndTimer();
      stopSyncTimer();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [elementId, startSyncTimer, stopEndTimer, stopSyncTimer, videoId]);

  const playSegment = useCallback((rate: number) => {
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
        setActivePlaybackRate(null);
        stopEndTimer();
        stopSyncTimer();
      }
    }, 80);
    setActivePlaybackRate(rate);
    startSyncTimer();
  }, [segment.endTime, segment.startTime, startSyncTimer, stopEndTimer, stopSyncTimer]);

  useEffect(() => {
    if (isReady && autoPlayRequest > 0) {
      playSegment(1);
    }
  }, [autoPlayRequest, isReady, playSegment]);

  useEffect(() => {
    if (!isReady) return;

    if (showYouTubeCaptions) {
      playerRef.current?.loadModule("captions");
    } else {
      playerRef.current?.unloadModule("captions");
    }
  }, [isReady, showYouTubeCaptions]);

  return (
    <section className="player-section">
      <div className="video-frame">
        <div id={elementId} />
      </div>
      {playerError && <p className="error-message">{playerError}</p>}
      <div className="video-scrubber">
        <span>{formatTimestamp(currentVideoTime)}</span>
        <input
          type="range"
          min="0"
          max={Math.max(videoDuration, 1)}
          step="0.1"
          value={Math.min(currentVideoTime, Math.max(videoDuration, 1))}
          disabled={!isReady || videoDuration <= 0}
          aria-label="Video timeline"
          onChange={(event) => {
            const nextTime = Number(event.target.value);
            setCurrentVideoTime(nextTime);
            playerRef.current?.seekTo(nextTime, true);
            onVideoTimeChange(nextTime);
          }}
        />
        <span>{videoDuration > 0 ? formatTimestamp(videoDuration) : "--:--"}</span>
      </div>
      <div className="control-row">
        <button
          className={activePlaybackRate === 1 ? "active-speed" : ""}
          onClick={() => playSegment(1)}
          disabled={!isReady}
          title="Play"
        >
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
        <button
          className={activePlaybackRate === slowRate ? "active-speed" : ""}
          onClick={() => playSegment(slowRate)}
          disabled={!isReady}
          title="Play Slow"
        >
          <Gauge size={20} />
          0.75x
        </button>
        <button
          className={showYouTubeCaptions ? "active-captions" : ""}
          onClick={() => setShowYouTubeCaptions((value) => !value)}
          disabled={!isReady}
          aria-label={showYouTubeCaptions ? "Hide YouTube subtitles" : "Show YouTube subtitles"}
          title={showYouTubeCaptions ? "Hide YouTube subtitles" : "Show YouTube subtitles"}
        >
          <Captions size={20} />
          CC
        </button>
        <button
          onClick={() => {
            playerRef.current?.pauseVideo();
            stopEndTimer();
            stopSyncTimer();
            setActivePlaybackRate(null);
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
  const activeRowRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: "center" });
  }, []);

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
              ref={segment.index === practice.currentSegmentIndex ? activeRowRef : undefined}
              className={[
                "segment-row",
                segment.isCompleted || segment.userAnswer.trim() ? "completed" : "",
                segment.index === practice.currentSegmentIndex ? "active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
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
