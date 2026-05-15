$env:Path = "D:\Codex work\tools\node-v24.15.0-win-x64;D:\Codex work\tools\postgresql-18.4\pgsql\bin;" + $env:Path
$env:npm_config_cache = "D:\Codex work\npm-cache"

& "D:\Codex work\tools\postgresql-18.4\pgsql\bin\pg_isready.exe" -h 127.0.0.1 -p 5433 -U postgres | Out-Null
if ($LASTEXITCODE -ne 0) {
  & "D:\Codex work\tools\postgresql-18.4\pgsql\bin\pg_ctl.exe" -D "D:\Codex work\postgres-data" -l "D:\Codex work\postgres-data\postgres.log" -o "-p 5433" start
}

Set-Location "D:\Codex work\ordertable-pilot"
& "D:\Codex work\tools\node-v24.15.0-win-x64\node.exe" ".\node_modules\next\dist\bin\next" dev --hostname 0.0.0.0 --port 3000
