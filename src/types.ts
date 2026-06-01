export type Segment = {
  id: string;
  index: number;
  startTime: number;
  endTime: number;
  arabicText: string;
  originalText?: string;
  userAnswer: string;
  replayCount: number;
  isCompleted: boolean;
  isDifficult: boolean;
};

export type Practice = {
  id: string;
  title: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  currentSegmentIndex: number;
  segments: Segment[];
};

export type AppSettings = {
  defaultPlaybackRate: number;
  autoPlayNextSegment: boolean;
  pauseAtEnd: boolean;
};
