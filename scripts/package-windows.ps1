param(
    [string]$OutputDir = "release",
    [switch]$IncludeMongoDump,
    [string]$MongoUri = "mongodb://localhost:27017",
    [string]$MongoDatabase = "python_edu"
)

$ErrorActionPreference = "Stop"

function Invoke-Robocopy {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source,
        [Parameter(Mandatory = $true)]
        [string]$Destination,
        [string[]]$ExtraArgs = @()
    )

    & robocopy $Source $Destination @ExtraArgs | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "robocopy failed (exit code $LASTEXITCODE) from '$Source' to '$Destination'."
    }
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $RepoRoot

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$PackageName = "monaco-ai-assist-web-win-$Timestamp"
$ReleaseRoot = Join-Path $RepoRoot $OutputDir
$StageDir = Join-Path $ReleaseRoot $PackageName
$ZipPath = Join-Path $ReleaseRoot "$PackageName.zip"

Write-Host "[1/6] Building frontend..."
npm run build
if ($LASTEXITCODE -ne 0) {
    throw "npm run build failed."
}

Write-Host "[2/6] Preparing release workspace..."
New-Item -ItemType Directory -Force -Path $ReleaseRoot | Out-Null
if (Test-Path -LiteralPath $StageDir) {
    Remove-Item -LiteralPath $StageDir -Recurse -Force
}
if (Test-Path -LiteralPath $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
}
New-Item -ItemType Directory -Force -Path $StageDir | Out-Null

Write-Host "[3/6] Copying backend and data files..."
$BackendSource = Join-Path $RepoRoot "backend"
$BackendTarget = Join-Path $StageDir "backend"
Invoke-Robocopy -Source $BackendSource -Destination $BackendTarget -ExtraArgs @(
    "/E",
    "/XD", ".venv", "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
    "/XF", ".env", "*.pyc"
)

$FrontendDistSource = Join-Path $RepoRoot "dist"
$FrontendDistTarget = Join-Path $BackendTarget "frontend_dist"
Invoke-Robocopy -Source $FrontendDistSource -Destination $FrontendDistTarget -ExtraArgs @("/E")

Write-Host "[4/6] Copying deployment scripts and templates..."
Copy-Item -LiteralPath (Join-Path $RepoRoot "deploy\windows\install-backend-deps.bat") -Destination (Join-Path $StageDir "install-backend-deps.bat") -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot "deploy\windows\start-server.bat") -Destination (Join-Path $StageDir "start-server.bat") -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot "deploy\windows\restore-mongo.bat") -Destination (Join-Path $StageDir "restore-mongo.bat") -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot "deploy\windows\.env.backend.example") -Destination (Join-Path $StageDir ".env.backend.example") -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot "deploy\windows\.env.frontend.production.example") -Destination (Join-Path $StageDir ".env.frontend.production.example") -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot "DEPLOY_WINDOWS.md") -Destination (Join-Path $StageDir "DEPLOY_WINDOWS.md") -Force

if ($IncludeMongoDump) {
    Write-Host "[5/6] Exporting MongoDB data..."
    $Mongodump = Get-Command mongodump -ErrorAction SilentlyContinue
    if ($null -eq $Mongodump) {
        Write-Warning "mongodump not found. Skipping MongoDB export."
    }
    else {
        $DumpDir = Join-Path $StageDir "mongo_dump"
        & $Mongodump.Source "--uri=$MongoUri" "--db=$MongoDatabase" "--out=$DumpDir"
        if ($LASTEXITCODE -ne 0) {
            throw "mongodump failed with exit code $LASTEXITCODE."
        }
    }
}
else {
    Write-Host "[5/6] Skipping MongoDB export (use -IncludeMongoDump to enable)."
}

$Manifest = [ordered]@{
    package_name = $PackageName
    created_at = (Get-Date).ToString("s")
    include_mongo_dump = [bool]$IncludeMongoDump
    mongo_uri = $MongoUri
    mongo_database = $MongoDatabase
    zip_path = $ZipPath
}
$Manifest | ConvertTo-Json | Set-Content -Path (Join-Path $StageDir "package-manifest.json")

Write-Host "[6/6] Creating zip archive..."
Compress-Archive -Path (Join-Path $StageDir "*") -DestinationPath $ZipPath -Force

Write-Host "Package ready: $ZipPath"

