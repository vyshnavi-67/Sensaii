# setup-node-and-build.ps1
# Automates installing nvm-windows (downloads installer), switching to Node 20,
# reinstalling dependencies, and running `npm run build`.
# RUN THIS SCRIPT IN AN ELEVATED POWERSHELL (Run as Administrator)

function Write-ErrAndExit($msg) {
    Write-Host "ERROR: $msg" -ForegroundColor Red
    exit 1
}

# Check admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "This script must be run as Administrator. Right-click PowerShell and choose 'Run as administrator'." -ForegroundColor Yellow
    Write-Host "Press Enter to exit..."; Read-Host | Out-Null
    exit 1
}

# Determine repo root (script assumes it's run from repo root or from anywhere)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path "$scriptDir\.." | Select-Object -ExpandProperty Path
Write-Host "Repository root: $repoRoot"

# Function to get latest nvm-windows release installer URL
function Get-Latest-NvmInstallerUrl {
    $api = 'https://api.github.com/repos/coreybutler/nvm-windows/releases/latest'
    try {
        $resp = Invoke-RestMethod -Uri $api -Headers @{ 'User-Agent' = 'PowerShell' } -UseBasicParsing
    } catch {
        Write-ErrAndExit "Failed to fetch nvm-windows release info from GitHub: $_"
    }
    foreach ($asset in $resp.assets) {
        if ($asset.name -match 'nvm-setup.*\\.exe$') { return $asset.browser_download_url }
    }
    return $null
}

$installerUrl = Get-Latest-NvmInstallerUrl
if (-not $installerUrl) {
    Write-ErrAndExit "Could not find nvm-windows installer URL from GitHub releases. Please download it manually from https://github.com/coreybutler/nvm-windows/releases"
}

Write-Host "Found nvm-windows installer: $installerUrl"
$tmp = [IO.Path]::GetTempFileName()
Remove-Item $tmp
$installerPath = "$tmp.exe"

Write-Host "Downloading installer to $installerPath..."
try {
    Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
} catch {
    Write-ErrAndExit "Failed to download installer: $_"
}

Write-Host "Launching installer. Complete the installer UI (accept defaults). Installer will block until closed."
Start-Process -FilePath $installerPath -Wait

Write-Host "Installer finished. You should close and re-open this PowerShell session after the installer completes to refresh PATH."
Write-Host "Press Enter to continue once you've re-opened PowerShell and ensured 'nvm' is available on PATH..."
Read-Host | Out-Null

# Verify nvm exists
$nvm = Get-Command nvm -ErrorAction SilentlyContinue
if (-not $nvm) { Write-ErrAndExit "'nvm' command not found. Make sure nvm-windows is installed and available on PATH in this shell." }

Write-Host "Installing Node 20 via nvm..."
# Use cmd /c to run nvm (nvm is a batch/cmd app)
$installNode = cmd /c "nvm install 20"
if ($LASTEXITCODE -ne 0) {
    Write-Host "nvm install may have failed or Node 20 already installed. Continuing..." -ForegroundColor Yellow
}

Write-Host "Switching to Node 20..."
cmd /c "nvm use 20"

# Verify node version
$nodeVersion = & node -v 2>$null
if (-not $nodeVersion) { Write-ErrAndExit "node not found after nvm use. Ensure nvm is correctly installed and you re-opened PowerShell." }
Write-Host "Using node $nodeVersion"

# Reinstall dependencies and build
Set-Location -Path $repoRoot
if (Test-Path node_modules) {
    Write-Host "Removing node_modules..."
    Remove-Item -Recurse -Force node_modules
}
if (Test-Path package-lock.json) {
    Write-Host "Removing package-lock.json..."
    Remove-Item -Force package-lock.json
}

Write-Host "Running npm install (this can take a few minutes)..."
$installLog = Join-Path $repoRoot 'install.log'
$proc = Start-Process -FilePath npm -ArgumentList 'install' -NoNewWindow -Wait -PassThru -RedirectStandardOutput $installLog -RedirectStandardError $installLog

Write-Host "npm install finished. Log: $installLog"

Write-Host "Running npm run build..."
$buildLog = Join-Path $repoRoot 'build.log'
$proc2 = Start-Process -FilePath npm -ArgumentList 'run','build' -NoNewWindow -Wait -PassThru -RedirectStandardOutput $buildLog -RedirectStandardError $buildLog

Write-Host "Build finished. Log: $buildLog"

Write-Host "--- BUILD LOG START ---"
Get-Content $buildLog -Tail 200 | ForEach-Object { Write-Host $_ }
Write-Host "--- BUILD LOG END ---"

Write-Host "Script complete. If the build failed, paste the build.log contents here and I'll analyze."