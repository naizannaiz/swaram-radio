# start-swaram.ps1
# ─────────────────────────────────────────────────────────────
# Swaram Radio — Broadcast Startup Script
# Run this before every broadcast. Takes ~20 seconds.
# ─────────────────────────────────────────────────────────────
#
# FIRST TIME SETUP (run once):
#   npm install -g pm2
#   Set the SUPABASE_ variables below with your project values.
#
# USAGE:
#   .\start-swaram.ps1
# ─────────────────────────────────────────────────────────────

$ErrorActionPreference = 'Stop'
$ProjectRoot = $PSScriptRoot
$ServerDir   = Join-Path $ProjectRoot "apps\server"

# ── Supabase config (read from web .env.local automatically) ──────────────
$envFile = Join-Path $ProjectRoot "apps\web\.env.local"
$envVars = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.+)$') {
        $envVars[$Matches[1].Trim()] = $Matches[2].Trim()
    }
}
$SUPABASE_URL  = $envVars['NEXT_PUBLIC_SUPABASE_URL']
$SUPABASE_KEY  = $envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY']

# ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔══════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║   🎙️  SWARAM RADIO — STARTUP     ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Build the server ──────────────────────────────────
Write-Host "[ 1/4 ] Building server..." -ForegroundColor Yellow
Push-Location $ServerDir
npm run build 2>&1 | Out-Null
Pop-Location
Write-Host "        ✓ Build complete" -ForegroundColor Green

# ── Step 2: Start / restart server with PM2 ───────────────────
Write-Host "[ 2/4 ] Starting server with PM2..." -ForegroundColor Yellow
Push-Location $ServerDir
$null = pm2 delete swaram-server 2>$null
pm2 start pm2.config.js 2>&1 | Out-Null
Pop-Location
Start-Sleep -Seconds 2
Write-Host "        ✓ Server running on :3001" -ForegroundColor Green

# ── Step 3: Start Cloudflare Quick Tunnel ─────────────────────
Write-Host "[ 3/4 ] Starting Cloudflare tunnel..." -ForegroundColor Yellow

# Run cloudflared as a background job so we can capture output
$tunnelJob = Start-Job -ScriptBlock {
    & cloudflared tunnel --url localhost:3001 2>&1
}

# Poll for the tunnel URL (appears within ~10 seconds)
$tunnelUrl = $null
$maxWait   = 30
for ($i = 0; $i -lt $maxWait; $i++) {
    Start-Sleep -Seconds 1
    $output = Receive-Job -Job $tunnelJob -Keep | Out-String
    if ($output -match "https://[\w-]+\.trycloudflare\.com") {
        $tunnelUrl = $Matches[0]
        break
    }
}

if (-not $tunnelUrl) {
    Write-Host "        ✗ Could not capture tunnel URL. Check your internet connection." -ForegroundColor Red
    exit 1
}
Write-Host "        ✓ Tunnel live: $tunnelUrl" -ForegroundColor Green

# ── Step 4: Register URL in Supabase ──────────────────────────
Write-Host "[ 4/4 ] Updating server URL in Supabase..." -ForegroundColor Yellow
try {
    $body = @(@{ id = "server_url"; value = $tunnelUrl }) | ConvertTo-Json -Compress
    Invoke-RestMethod `
        -Uri "$SUPABASE_URL/rest/v1/radio_config" `
        -Method POST `
        -Headers @{
            apikey        = $SUPABASE_KEY
            Authorization = "Bearer $SUPABASE_KEY"
            "Content-Type" = "application/json"
            Prefer        = "resolution=merge-duplicates"
        } `
        -Body $body | Out-Null
    Write-Host "        ✓ URL saved to Supabase" -ForegroundColor Green
} catch {
    Write-Host "        ✗ Supabase update failed: $_" -ForegroundColor Red
    Write-Host "          Listeners must use: $tunnelUrl" -ForegroundColor Yellow
}

# ── Done ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ┌─────────────────────────────────────────┐" -ForegroundColor Cyan
Write-Host "  │  ✅  SWARAM IS READY FOR BROADCAST       │" -ForegroundColor Cyan
Write-Host "  ├─────────────────────────────────────────┤" -ForegroundColor Cyan
Write-Host "  │  Server  : http://localhost:3001         │" -ForegroundColor White
Write-Host "  │  Tunnel  : $tunnelUrl" -ForegroundColor White
Write-Host "  │  Share your Vercel URL with listeners   │" -ForegroundColor White
Write-Host "  └─────────────────────────────────────────┘" -ForegroundColor Cyan
Write-Host ""
Write-Host "  To stop:  pm2 stop swaram-server" -ForegroundColor Gray
Write-Host "  Logs:     pm2 logs swaram-server" -ForegroundColor Gray
Write-Host ""
