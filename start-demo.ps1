# ComplyX one-shot demo launcher (audit item I-6).
# Boots Qdrant (docker compose, named volume), the FastAPI backend and the
# Next.js frontend, verifying each layer and failing loudly if one is down.
#
# Ports: backend 8001, frontend 3002 (3000/8000 are taken by the bookress
# project on this machine). Change $BackendPort/$FrontendPort if needed.

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$BackendPort = 8001
$FrontendPort = 3002

function Fail($msg) { Write-Host "`n[FAIL] $msg" -ForegroundColor Red; exit 1 }
function Ok($msg) { Write-Host "[ OK ] $msg" -ForegroundColor Green }
function Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }

Step "1/4 Docker + Qdrant"
try { docker info *> $null } catch { Fail "Docker Desktop is not running. Start it and retry." }
Push-Location $Root
docker compose up -d qdrant | Out-Null
Pop-Location
$qdrantUp = $false
foreach ($i in 1..20) {
    try {
        $null = Invoke-RestMethod "http://127.0.0.1:6333/collections" -TimeoutSec 2
        $qdrantUp = $true; break
    } catch { Start-Sleep 1 }
}
if (-not $qdrantUp) { Fail "Qdrant did not come up on port 6333." }
Ok "Qdrant is up (port 6333)"

Step "2/4 Backend (FastAPI, port $BackendPort)"
if (-not (Test-Path "$Root\.env")) { Fail "Missing .env in $Root (copy .env.example and set ANTHROPIC_API_KEY)." }
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "cd '$Root\backend'; `$env:PYTHONUTF8='1'; uvicorn app.main:app --port $BackendPort --host 0.0.0.0"
$health = $null
foreach ($i in 1..45) {
    try {
        $health = Invoke-RestMethod "http://127.0.0.1:$BackendPort/health" -TimeoutSec 2
        break
    } catch { Start-Sleep 2 }
}
if (-not $health) { Fail "Backend did not come up on port $BackendPort. Check the backend window for errors." }
if (-not $health.ready) { Fail "Backend is up but Qdrant is EMPTY. Run: cd backend; python -m app.ingest --dir data/regulations" }
Ok "Backend healthy — $($health.indexed_articles) articles indexed (corpus $($health.corpus_version))"

Step "3/4 Frontend (Next.js, port $FrontendPort)"
$envLocal = "$Root\frontend\.env.local"
[System.IO.File]::WriteAllText($envLocal, "BACKEND_URL=http://127.0.0.1:$BackendPort`nPORT=$FrontendPort`n", (New-Object System.Text.UTF8Encoding($false)))
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "cd '$Root\frontend'; `$env:PORT='$FrontendPort'; npm run dev"
$frontUp = $false
foreach ($i in 1..45) {
    try {
        $resp = Invoke-WebRequest "http://127.0.0.1:$FrontendPort" -TimeoutSec 2 -UseBasicParsing
        if ($resp.StatusCode -eq 200) { $frontUp = $true; break }
    } catch { Start-Sleep 2 }
}
if (-not $frontUp) { Fail "Frontend did not come up on port $FrontendPort. Check the frontend window." }
Ok "Frontend is up (port $FrontendPort)"

Step "4/4 Ready"
Ok "ComplyX is live: http://localhost:$FrontendPort"
Start-Process "http://localhost:$FrontendPort"
