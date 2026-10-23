# Publish the static EdgeWatch browser demo with GitHub Pages

The website is contained in `demo/`. It requires **no backend**, build pipeline, API key, or storage service.

## Why publication is not automatic

The portfolio repository started private for owner review. GitHub Free generally supports Pages from **public repositories**. GitHub Pro/Team/Enterprise have options for Pages from private repositories; a Pages website created from a private repository may itself be **publicly accessible** depending on account and site settings. Publishing the site is therefore a separate, deliberate step.

The workflow `.github/workflows/pages-demo.yml` uses **manual workflow_dispatch only** so committing code to a private repository does not unexpectedly attempt a public deployment or create a failing Pages build on a Free account.

## Option A: publish from this repository (after privacy review)

1. Review `README.md`, `SECURITY.md`, `docs/publication-checklist.md`, and `demo/` for any employer-confidential or licensed material.
2. Verify the GitHub account plan supports Pages for the repository's desired visibility. Do not change repository visibility without owner approval.
3. In GitHub, open **Settings → Pages** and select **GitHub Actions** under Build and deployment / Source.
4. Open **Actions → Deploy EdgeWatch static demo → Run workflow** and select `main`.
5. Wait for the deployment to finish, then use the **Visit site** link in **Settings → Pages**. A standard project URL will resemble `https://<username>.github.io/<repository-name>/`.
6. Verify the heat, outage, restore, chart filters, and CSV export on the actual Pages URL.
7. Only after the site is live and reviewed, add its URL to the main README and GitHub repository **About → Website**.

## Option B (recommended for privacy): separate public demo repository

Keep this source repo private. Create a different **public** repository containing only `demo/` files at the repository root, plus this clearly labeled README. Configure GitHub Pages there. This separates a recruiter's public entry point from any nonpublic development material. Do not publish any workplace files or production credentials.

## Troubleshooting

- **Pages Settings does not offer publishing for this private repository:** The account plan likely lacks private-repo Pages support; use a separate public demonstration repository or an approved hosting account.
- **A Pages workflow fails:** Confirm Pages source is GitHub Actions, the branch is `main`, and Actions permissions permit Pages deployments. See job logs for details.
- **Blank chart or controls:** Check developer console, ensure the `app.mjs` and `sim-engine.mjs` files were uploaded next to `index.html`, and that module MIME types are correct.
- **File download blocked:** Allow downloads for the site in your browser. All CSV rows are synthetic.
