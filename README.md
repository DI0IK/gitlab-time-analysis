# GitLab Time Analysis

A Next.js dashboard for analyzing time tracking data from GitLab groups. The app discovers descendant groups under a configured GitLab path, pulls members, labels, timelogs, and sprint windows from GitLab, and renders a set of summary views for workload and sprint analysis.

## What It Shows

The main group page combines several views:

- Summary cards for total members, total sprints, total time spent, average time per sprint, and the current/previous sprint focus category.
- A heatmap of timelog activity by sprint and weekday.
- Total hours per sprint, stacked by member.
- Time spent per category, including issues with missing estimates and uncategorized work.
- Time spent per member, grouped by label category.
- A sprint overview table that can be shared or exported as SVG.

The landing page lists all descendant groups under the configured GitLab group path and links into each group-specific analysis page.

## Requirements

- Node.js 21 or newer is recommended, matching the container image used in [Dockerfile](Dockerfile).
- A GitLab personal access token or other token with permission to read the configured groups, labels, issues, and timelogs.
- A GitLab group path that acts as the root for all analyzed descendant groups.

## Configuration

The application reads configuration from environment variables. In a local setup, place them in `.env.local`.

| Variable                | Required | Purpose                                                                                                                        |
| ----------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `GITLAB_TOKEN`          | Yes      | Bearer token used for GitLab GraphQL and REST requests.                                                                        |
| `GITLAB_GROUP_PATH`     | Yes      | Full path to the parent GitLab group whose descendant groups will be listed.                                                   |
| `GITLAB_DOMAIN`         | No       | GitLab base URL. Defaults to `https://gitlab.com`.                                                                             |
| `PROJECT_START_DATE`    | Yes      | Start date used for fetching timelogs and calculating sprint boundaries.                                                       |
| `PROJECT_END_DATE`      | Yes      | End date used for fetching timelogs and generating sprint windows.                                                             |
| `SPRINT_START_WEEKDAY`  | No       | Sprint start weekday. Accepts a weekday name or numeric day index. Defaults to the weekday of `PROJECT_START_DATE` if omitted. |
| `SPRINT_DURATION_WEEKS` | No       | Sprint length in weeks. Defaults to `1` when omitted in sprint calculations.                                                   |

Example `.env.local`:

```env
GITLAB_TOKEN=glpat-your-token
GITLAB_GROUP_PATH=org/team
GITLAB_DOMAIN=https://gitlab.com
PROJECT_START_DATE=2025-01-01
PROJECT_END_DATE=2025-12-31
SPRINT_START_WEEKDAY=Monday
SPRINT_DURATION_WEEKS=2
```

## Getting Started

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` starts the Next.js development server.
- `npm run build` creates a production build.
- `npm run start` runs the production server after a build.
- `npm run lint` runs ESLint across the codebase.

## How the App Works

### Data Flow

1. The home page calls `/api/groups` to list descendant GitLab groups under `GITLAB_GROUP_PATH`.
2. Selecting a group opens `/[groupId]`, which loads the group’s members, labels, timelogs, and sprint definitions from local API routes.
3. Those API routes proxy GitLab GraphQL/REST data and apply lightweight caching and normalization.
4. The dashboard components render charts, tables, and summaries from a shared React context.

### GitLab Integration

The app uses two helper functions in [app/api/gitlab.ts](app/api/gitlab.ts):

- `runGitlabGraphQLQuery()` for GraphQL queries.
- `runGitlabRESTQuery()` for REST requests.

Requests are authenticated with `GITLAB_TOKEN` and sent to `GITLAB_DOMAIN` when configured, otherwise to `https://gitlab.com`.

### Caching

Member, label, and timelog endpoints use stale-while-revalidate style in-memory caching with a three-minute TTL. The API can serve cached data immediately while refreshing in the background.

## API Routes

The application exposes a small set of app-local API routes that wrap GitLab data:

- `GET /api/groups` lists descendant groups under the configured root group.
- `GET /api/group/[id]/members` returns the group members used by the dashboard.
- `GET /api/group/[id]/labels` returns labels grouped by their namespace prefix.
- `GET /api/group/[id]/timelogs` returns mapped timelog entries for the configured project date range.
- `GET /api/group/[id]/sprints` generates sprint windows from the configured start/end dates and sprint duration.
- `GET /api/group/[id]/table.svg?sprintNumber=...&labelGroup=...` renders a shareable SVG version of the sprint overview table.

## Development Notes

- The dashboard uses [MUI](https://mui.com/) for cards, tables, selectors, and charts.
- Charts are powered by `@mui/x-charts`.
- The SVG export endpoint uses `satori` and downloads the Inter font from a CDN at render time.
- The project is built with the Next.js App Router and client-side data fetching for the visible dashboard.

## Docker

The repository includes a production Dockerfile that builds the app with Node.js 21 Alpine and serves it with `npm start`.

Build and run locally:

```bash
docker build -t gitlab-time-analysis .
docker run --rm -p 3000:3000 --env-file .env.local gitlab-time-analysis
```

## Deployment

The repository also includes a GitHub Actions workflow in [.github/workflows/docker-build.yml](.github/workflows/docker-build.yml) that builds and publishes the Docker image to GHCR on pushes to `main` and on manual dispatch.

For non-Docker deployments, run the standard Next.js production flow:

```bash
npm run build
npm run start
```

## Troubleshooting

- If the home page is empty, verify that `GITLAB_GROUP_PATH` points to a parent group that actually has descendant groups.
- If dashboards return empty data, confirm that the token can read the group’s timelogs, labels, and members.
- If sprint windows look wrong, recheck `PROJECT_START_DATE`, `PROJECT_END_DATE`, `SPRINT_START_WEEKDAY`, and `SPRINT_DURATION_WEEKS`.
- If the SVG export route fails, confirm that the selected sprint number exists and that the chosen label group exists in the label data.

## Repository Layout

- [app/page.tsx](app/page.tsx) is the landing page that lists available groups.
- [app/[groupId]/page.tsx](app/[groupId]/page.tsx) is the main analytics dashboard.
- [app/api/](app/api) contains the GitLab-backed API routes and helpers.
- [app/components/](app/components) contains the visual dashboard widgets.
- [Dockerfile](Dockerfile) defines the container build and runtime image.

## License

GNU General Public License v3.0
