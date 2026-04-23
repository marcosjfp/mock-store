param(
    [switch]$DepsOnly,
    [switch]$RunOnly
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Assert-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found in PATH."
    }
}

function Resolve-PythonCommand {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        return @("py", "-3")
    }
    if (Get-Command python -ErrorAction SilentlyContinue) {
        return @("python")
    }
    throw "Python was not found. Install Python 3.10+ and try again."
}

$installDeps = $true
$runApps = $true

if ($DepsOnly) {
    $runApps = $false
}
if ($RunOnly) {
    $installDeps = $false
}

Assert-Command "npm"
$pythonCommand = Resolve-PythonCommand
$pythonArgs = @()
if ($pythonCommand.Length -gt 1) {
    $pythonArgs = $pythonCommand[1..($pythonCommand.Length - 1)]
}

$venvDir = Join-Path $root "backend\.venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"
$venvPip = Join-Path $venvDir "Scripts\pip.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host "[setup] Creating backend virtual environment..."
    & $pythonCommand[0] @pythonArgs -m venv $venvDir
}

if ($installDeps) {
    Write-Host "[setup] Installing backend dependencies..."
    & $venvPip install --upgrade pip
    & $venvPip install -r (Join-Path $root "backend\requirements.txt")

    Write-Host "[setup] Installing frontend dependencies..."
    Push-Location (Join-Path $root "frontend")
    try {
        npm install
    }
    finally {
        Pop-Location
    }
}

$backendEnvFile = Join-Path $root "backend\.env"
if (-not (Test-Path $backendEnvFile)) {
    Write-Host "[setup] Creating backend .env for local Windows run..."
    @(
        "DATABASE_URL=sqlite+aiosqlite:///./dev.db"
        "REDIS_ENABLED=false"
        "RABBITMQ_ENABLED=false"
        "SECRET_KEY=dev-secret-key-change-me"
        "CORS_ORIGINS=[\"http://localhost:5173\"]"
    ) | Set-Content -Path $backendEnvFile -Encoding ASCII
}

if ($runApps) {
    Write-Host "[setup] Applying backend migrations..."
    Push-Location (Join-Path $root "backend")
    try {
        & $venvPython -m alembic upgrade head
    }
    finally {
        Pop-Location
    }

    Write-Host "[run] Starting backend in a new PowerShell window..."
    $backendCommand = "Set-Location `"$($root)\backend`"; & `"$venvPython`" -m uvicorn app.main:app --reload"
    Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-Command", $backendCommand
    ) | Out-Null

    Write-Host "[run] Starting frontend in this window (press Ctrl+C to stop)..."
    Push-Location (Join-Path $root "frontend")
    try {
        npm run dev
    }
    finally {
        Pop-Location
    }
}

Write-Host "Done."
