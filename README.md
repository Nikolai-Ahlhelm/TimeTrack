# TimeTrack

A self-hosted, multi-user time-tracking web app: clock in/out, review and
edit a table of work days, filter/sort/search it, and export to CSV. See
[AGENTS.md](AGENTS.md) for the full architecture and project plan.

## Quick start

**Development** (Windows / PowerShell):
```powershell
./dev.ps1
```
Then open http://localhost:5173 and sign in as `dev` / `dev`.

**Production, without Docker**:
```powershell
$env:JWT_SECRET = "<a long random secret>"
./start-prod.ps1
```
Then open http://localhost:4000 and complete the first-launch admin setup.

**Production, with Docker**:
```bash
docker build -t timetrack .
docker run -d -p 4000:4000 -e JWT_SECRET="<a long random secret>" \
  -v timetrack-data:/app/data timetrack
```

Pre-built images are published to GHCR on every push to `main` via GitHub
Actions.

**Production, with Docker Compose**:
```bash
docker compose up -d
```
Uses the template [docker-compose.yml](docker-compose.yml), which pulls the
pre-built GHCR image. Set a real `JWT_SECRET` before starting, and swap
`image: ghcr.io/nikolai-ahlhelm/timetrack:latest` for `build: .` if you'd
rather build from source. Then open http://localhost:4000 and complete the
first-launch admin setup.
