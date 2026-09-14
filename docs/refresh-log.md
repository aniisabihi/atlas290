# Monthly refresh log

One line per run of `.github/workflows/refresh.yml`. It exists so that the scheduled workflow
keeps running: GitHub disables scheduled workflows in a public repository after 60 days without
repository activity, and a project whose data happens to be stable for two months would otherwise
quietly stop checking for new data — the exact failure a monthly job exists to prevent.
