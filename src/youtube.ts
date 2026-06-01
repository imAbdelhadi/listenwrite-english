export function extractYouTubeVideoId(url: string): string | null {
  const trimmed = url.trim();

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        return normalizeVideoId(parsed.searchParams.get("v"));
      }

      if (parsed.pathname.startsWith("/embed/") || parsed.pathname.startsWith("/shorts/")) {
        return normalizeVideoId(parsed.pathname.split("/")[2]);
      }
    }

    if (host === "youtu.be") {
      return normalizeVideoId(parsed.pathname.slice(1).split("/")[0]);
    }
  } catch {
    return normalizeVideoId(trimmed);
  }

  return null;
}

function normalizeVideoId(value: string | null): string | null {
  if (!value) return null;
  const id = value.trim();
  return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
}
