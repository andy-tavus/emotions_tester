# Tavus Emotion Tester

Static, frontend-only tool for testing Phoenix-4 replica emotions via `conversation.echo` with explicit `<emotion value="…"/>` tags.

No build step. No backend.

**Live app:** https://andy-tavus.github.io/emotions_tester/

## Run locally

Browsers block camera/microphone on `file://` URLs, so serve the folder once:

```bash
cd emotions_tester
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

Optional: pass a conversation ID in the query string:

```
http://localhost:8080/?conversation_id=c477c9dd7aa6e4fe
```

## Usage

1. Create a conversation (Developer Portal or API) with a **Phoenix-4** replica and echo-friendly persona.
2. Paste the **conversation ID**.
3. Click **Join conversation** — replica video/audio streams on the right (no iframe, no camera/mic prompt, no local webcam).
4. Edit the sample phrase for an emotion, then click the emotion button to send an echo with that tag.

Joins `https://tavus.daily.co/{conversation_id}` automatically.

## Docs

- [Emotion Control with Phoenix-4](https://docs.tavus.io/sections/conversational-video-interface/quickstart/emotional-expression)
- [Interaction events (`conversation.echo`)](https://docs.tavus.io/sections/conversational-video-interface/interactions-protocols/overview)
