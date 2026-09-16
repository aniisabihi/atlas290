# Monthly refresh log

One line per run of `.github/workflows/refresh.yml`. It exists so that the scheduled workflow
keeps running: GitHub disables scheduled workflows in a public repository after 60 days without
repository activity, and a project whose data happens to be stable for two months would otherwise
quietly stop checking for new data — the exact failure a monthly job exists to prevent.

**No entries yet, and that is expected.** The schedule is 04:17 UTC on the first of each month and
the workflow was added on 2026-09-14, so the first run is due 2026-10-01. Said here because an
empty heartbeat file is otherwise indistinguishable from a disabled workflow, which is precisely
the failure this file was invented to make visible. If the first entry has not appeared by
2026-10-02, check the Actions tab rather than assuming SCB published nothing.

The run itself has never been exercised end to end — it reaches the network, opens a pull request
and pushes to `main`, so it is not something to trigger casually. `workflow_dispatch` is there for
whoever wants to prove it works before waiting a month.
