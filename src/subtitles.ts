import type { Segment } from "./types";

const cueTimePattern =
  /(?<start>\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{1,2}:\d{2}[,.]\d{1,3})\s*-->\s*(?<end>\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{1,2}:\d{2}[,.]\d{1,3})/;

export function parseSubtitleFile(content: string): Segment[] {
  const normalized = content.replace(/\r/g, "").replace(/^\uFEFF/, "");
  const lines = normalized.split("\n");
  const segments: Segment[] = [];

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

    const arabicText = textLines.join(" ").replace(/\s+/g, " ").trim();
    if (Number.isFinite(startTime) && Number.isFinite(endTime) && endTime > startTime && arabicText) {
      const segmentIndex = segments.length;
      segments.push({
        id: `segment_${segmentIndex + 1}`,
        index: segmentIndex,
        startTime,
        endTime,
        arabicText,
        userAnswer: "",
        replayCount: 0,
        isCompleted: false,
        isDifficult: false,
      });
    }

    index += 1;
  }

  return segments;
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
