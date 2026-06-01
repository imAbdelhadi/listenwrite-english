# ListenWrite English

**ListenWrite English** is a mobile-first English listening practice and English dictation app that turns YouTube videos with Arabic subtitles into sentence-by-sentence writing practice.

It helps Arabic-speaking learners improve English listening, writing, vocabulary, sentence structure, and active recall by combining YouTube audio, Arabic subtitle meaning, replay controls, and a focused writing box.

Keywords: **Learn English from YouTube**, **English listening practice**, **English dictation app**, **Arabic subtitles**, **Language learning tool**, **YouTube language learning**, **English writing practice**, **English listening trainer**.

## Project Overview

### English

ListenWrite English lets learners paste a YouTube video URL, upload an Arabic `.srt` or `.vtt` subtitle file, and practice one subtitle segment at a time. The app plays only the selected timestamp range, shows the Arabic meaning, and asks the learner to write the English sentence they hear.

The project solves a common learning problem: subtitle editors and video players are not designed for repeated listening and dictation practice on mobile. ListenWrite English makes replaying, slowing down, navigating, marking difficult segments, and saving progress simple.

### العربية

**ListenWrite English** هو تطبيق ويب يساعد متعلمي اللغة الإنجليزية الناطقين بالعربية على التدريب من مقاطع YouTube. يقوم المستخدم بإضافة رابط فيديو ورفع ملف ترجمة عربية فقط، ثم يقسم التطبيق الفيديو إلى مقاطع قصيرة حسب توقيت الترجمة.

يعرض التطبيق معنى الجملة بالعربية، ويشغل الجزء المناسب من الفيديو، ثم يكتب المستخدم الجملة الإنجليزية التي يسمعها. الهدف هو تحسين الاستماع، الكتابة، التذكر النشط، وفهم الجمل الإنجليزية الطبيعية بطريقة سهلة على الجوال.

## Screenshots

Screenshots can be added after publishing the first public release.

| Home | New Practice | Practice |
| --- | --- | --- |
| `docs/screenshots/home.png` | `docs/screenshots/new-practice.png` | `docs/screenshots/practice.png` |

## Features

- Create a practice from a YouTube URL and Arabic subtitle file.
- Supports `.srt` and `.vtt` subtitle formats.
- Parses subtitle timestamps into practice segments.
- Plays only the active subtitle segment.
- Replay the same segment with one tap.
- Slow playback at `0.75x`.
- Optional YouTube caption toggle when captions are available.
- Active subtitle sync when seeking through the video timeline.
- Large mobile-friendly writing box for English dictation.
- Previous, Next, and Mark as Difficult controls stay accessible on mobile.
- Segment list with timestamps, completion color, difficult markers, and auto-scroll to the active segment.
- Saves practices, answers, replay counts, progress, and difficult markers in Supabase.
- Public app with no login, signup, or authentication required.

## Tech Stack

- React
- TypeScript
- Vite
- Supabase Database
- YouTube IFrame Player API
- Lucide React icons
- CSS
- Vercel

## Installation

```bash
git clone <repository-url>
cd listenwrite-english
npm install
npm run dev
```

The app will usually run at:

```text
http://localhost:5173
```

## Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

You can find these values in your Supabase project settings.

Because this is a frontend-only public app, the Supabase anon key is exposed in the browser. Configure Row Level Security policies carefully for your use case.

## Database Setup

This project requires one Supabase table:

- `public.practices`

The table stores practice metadata and segment data as JSON.

### Setup Steps

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Copy the contents of `supabase-schema.sql`.
4. Run the SQL.
5. Confirm that the `public.practices` table exists.
6. Confirm that Row Level Security policies are enabled for public read/write access.

The included SQL creates:

- `public.practices`
- `practices_last_opened_at_idx`
- Public anonymous policies for select, insert, update, and delete

This matches the current no-auth MVP. For a production app with private user data, add authentication and user-scoped RLS policies.

## Deployment

### Deploy to Vercel

1. Push this repository to GitHub.
2. Open Vercel and create a new project.
3. Connect the GitHub repository.
4. Set the framework preset to Vite if Vercel does not detect it automatically.
5. Add environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

6. Deploy.

### Custom Domain

1. Open the project in Vercel.
2. Go to **Settings > Domains**.
3. Add your custom domain.
4. Follow the DNS instructions from Vercel.
5. Wait for DNS verification and SSL provisioning.

## Usage Guide

1. Open the app.
2. Click **New Practice**.
3. Paste a YouTube URL.
4. Upload an Arabic `.srt` or `.vtt` subtitle file.
5. Create the practice.
6. Start listening to one subtitle segment at a time.
7. Read the Arabic meaning.
8. Write the English sentence you hear.
9. Use **Replay** to repeat the same segment.
10. Use **0.75x** to slow down playback.
11. Use **Previous** and **Next** to move between segments.
12. Mark hard segments with **Mark as Difficult**.
13. Open the segment list to jump to any timestamp.
14. Return later and continue from saved progress.

## Future Roadmap

- AI transcription
- Automatic answer checking
- Similarity scoring
- Missing/wrong word highlighting
- Difficult segment review mode
- Spaced repetition
- Export answers to TXT, CSV, and JSON
- PWA support
- User accounts and private progress, optional
- Cloud sync across devices

## Contributing

Contributions are welcome. Please read `CONTRIBUTING.md` before opening an issue or pull request.

## License

This project is released under the MIT License. See `LICENSE` for details.
