# Publishing EdgeWatch on GitHub

**Before anything:** review [publication-checklist.md](publication-checklist.md) and obtain any approval required by your employment agreement. This repository deliberately contains only independent synthetic software, but the case-study narrative may still warrant review.

## Option 1: Upload using GitHub's website (no Git required)

1. Create a new repository at https://github.com/new named `industrial-iot-temperature-monitoring`.
2. Start it as **Private** so you can inspect everything before making it public. Do not add a GitHub-generated README or license (they are included here).
3. On the new repo page, choose **Add file → Upload files** and drag the **contents** of the unzipped project folder (not the ZIP alone). Note: hidden files and nested directory uploads may be easier through Git or GitHub Desktop.
4. Confirm `.github/workflows/ci.yml`, `.gitignore`, and every source directory are included.
5. Review the committed file list for confidential data. Enable available secret scanning and push protection.
6. Only after reviewing permissions and the repo contents, change visibility to **Public**.
7. In GitHub repository settings, select `assets/edgewatch-dashboard.png` (or a prepared preview) as the social preview image.
8. Add topics: `industrial-iot`, `python`, `mqtt`, `chirpstack`, `raspberry-pi`, `telemetry`, `edge-computing`, `sqlite`, `monitoring`, `portfolio`.

## Option 2: Git command line (recommended)

From the unzipped project directory:

```bash
git init
git add .
git status  # Inspect exactly what will be committed.
git commit -m "Initial release: synthetic industrial IoT telemetry demo"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/industrial-iot-temperature-monitoring.git
git push -u origin main
```

Create the empty remote repository on GitHub first, as **Private**. Do not commit secrets or run `git add` from the wrong directory.

## Finalize presentation

- Update `YOUR_GITHUB_USERNAME` in README.
- Place screenshot near the top; already included in README.
- Ensure GitHub Actions **Tests and public-release checks** passes.
- Add a concise repo description: "Industrial IoT monitoring demo: LoRaWAN/MQTT telemetry, SQLite, alerts, CSV, and a simulated live dashboard."
- Pin the repo on your profile, and add a short LinkedIn project summary after confirming publication rights.
- Be prepared to walk through `edgewatch/storage.py`, `edgewatch/ingest.py`, the alert state machine, and your tests in interviews.
