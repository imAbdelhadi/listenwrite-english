import type { Segment } from "./types";

export type SubtitleCue = {
  startTime: number;
  endTime: number;
  text: string;
};

const cueTimePattern =
  /(?<start>\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{1,2}:\d{2}[,.]\d{1,3})\s*-->\s*(?<end>\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{1,2}:\d{2}[,.]\d{1,3})/;

export function parseSubtitleCues(content: string): SubtitleCue[] {
  const normalized = content.replace(/\r/g, "").replace(/^\uFEFF/, "");
  const lines = normalized.split("\n");
  const cues: SubtitleCue[] = [];

  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    const match = line.match(cueTimePattern);

    if (!match?.groups) {
      index += 1;
      continue;
    }

    const startTime = parseTimeToSeconds(match.groups.start);
    const endTime = parseTimeToSeconds(match.groups.end);
    index += 1;

    const textLines: string[] = [];
    while (index < lines.length && lines[index].trim() !== "") {
      const text = lines[index].trim();
      if (!text.startsWith("NOTE") && !text.includes("-->")) {
        textLines.push(stripTags(text));
      }
      index += 1;
    }

    const text = textLines.join(" ").replace(/\s+/g, " ").trim();
    if (Number.isFinite(startTime) && Number.isFinite(endTime) && endTime > startTime && text) {
      cues.push({ startTime, endTime, text });
    }

    index += 1;
  }

  return cues;
}

export function parseSubtitleFile(content: string): Segment[] {
  return parseSubtitleCues(content).map((cue, index) => ({
    id: `segment_${index + 1}`,
    index,
    startTime: cue.startTime,
    endTime: cue.endTime,
    arabicText: cue.text,
    userAnswer: "",
    replayCount: 0,
    isCompleted: false,
    isDifficult: false,
  }));
}

export function parseTimeToSeconds(value: string): number {
  const parts = value.replace(",", ".").split(":");
  const secondsPart = Number(parts.pop());
  const minutes = Number(parts.pop() ?? 0);
  const hours = Number(parts.pop() ?? 0);

  if ([hours, minutes, secondsPart].some((part) => Number.isNaN(part))) {
    return Number.NaN;
  }

  return hours * 3600 + minutes * 60 + secondsPart;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "").replace(/\{\\.*?\}/g, "");
}
