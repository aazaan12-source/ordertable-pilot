$env:Path = "D:\Codex work\tools\node-v24.15.0-win-x64;D:\Codex work\tools\postgresql-18.4\pgsql\bin;" + $env:Path
$env:npm_config_cache = "D:\Codex work\npm-cache"
Set-Location "D:\Codex work\ordertable-pilot"
& "D:\Codex work\tools\node-v24.15.0-win-x64\node.exe" ".\node_modules\next\dist\bin\next" dev --hostname 0.0.0.0 --port 3000
