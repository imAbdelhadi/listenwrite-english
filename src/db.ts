import { createClient } from "@supabase/supabase-js";
import type { Practice } from "./types";

type PracticeRow = {
  id: string;
  title: string;
  youtube_url: string;
  youtube_video_id: string;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
  current_segment_index: number;
  segments: Practice["segments"];
};

const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables.");
}

export const db = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

export async function getPractices(): Promise<Practice[]> {
  const { data, error } = await db
    .from("practices")
    .select("*")
    .order("last_opened_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapPracticeFromRow);
}

export async function getPractice(id: string): Promise<Practice | undefined> {
  const { data, error } = await db.from("practices").select("*").eq("id", id).maybeSingle();

  if (error) throw error;
  return data ? mapPracticeFromRow(data) : undefined;
}

export async function savePractice(practice: Practice): Promise<void> {
  const { error } = await db.from("practices").upsert(mapPracticeToRow({
    ...practice,
    updatedAt: new Date().toISOString(),
  }));

  if (error) throw error;
}

export async function deletePractice(id: string): Promise<void> {
  const { error } = await db.from("practices").delete().eq("id", id);
  if (error) throw error;
}

function mapPracticeFromRow(row: PracticeRow): Practice {
  return {
    id: row.id,
    title: row.title,
    youtubeUrl: row.youtube_url,
    youtubeVideoId: row.youtube_video_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOpenedAt: row.last_opened_at,
    currentSegmentIndex: row.current_segment_index,
    segments: row.segments,
  };
}

function mapPracticeToRow(practice: Practice): PracticeRow {
  return {
    id: practice.id,
    title: practice.title,
    youtube_url: practice.youtubeUrl,
    youtube_video_id: practice.youtubeVideoId,
    created_at: practice.createdAt,
    updated_at: practice.updatedAt,
    last_opened_at: practice.lastOpenedAt,
    current_segment_index: practice.currentSegmentIndex,
    segments: practice.segments,
  };
}
