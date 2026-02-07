<#
run_sku_migration.ps1
PowerShell automation to safely execute SKU migration sequence.

Steps performed:
 1) Apply first migration SQL (adds nullable `sku` to order_items)
 2) Run `npx prisma generate`
 3) Run the Node backfill script `scripts/backfillSku.js` and log output
 4) Optionally run the verification SQL using mysql CLI (or ask user to run manually)
 5) Pause for manual confirmation to ensure `missing_sku = 0`
 6) If confirmed, apply second migration SQL (make `sku` NOT NULL and drop FK/itemId)
 7) Run `npx prisma generate` again
 8) Optionally run verification SQL again

Important safety notes:
 - BACKUP your database before running this script.
 - This script will NOT automatically run the second migration unless you explicitly confirm.
 - The script assumes `npx` and `node` are available in PATH. For verification of SQL it will try to use `mysql` CLI if you choose to.

Usage: Run from repository root in PowerShell (Windows PowerShell / PowerShell Core):
  PS> .\run_sku_migration.ps1

#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Paths (relative to repo root)
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$migration1 = Join-Path $projectRoot "prisma\migrations\20251031_add_sku_to_orderitem\migration.sql"
$migration2 = Join-Path $projectRoot "prisma\migrations\20251031_make_sku_non_nullable_and_drop_fk\migration.sql"
$backfillScript = Join-Path $projectRoot "scripts\backfillSku.js"
$verifySql = Join-Path $projectRoot "prisma\verify_orderitems_has_sku.sql"
$verifyNodeScript = Join-Path $projectRoot "scripts\verifySku.js"
$prismaSchema = Join-Path $projectRoot "prisma\schema.prisma"

function Fail([string]$msg) {
    Write-Host "ERROR: $msg" -ForegroundColor Red
    exit 1
}

function CheckFile([string]$path) {
    if (-Not (Test-Path $path)) {
        Fail "Required file not found: $path"
    }
}

function RunCmd([string]$cmd, [string[]]$args) {
    Write-Host "Running: $cmd $($args -join ' ')" -ForegroundColor Cyan
    Add-Content $logFile "\n--- Running: $cmd $($args -join ' ') ---"
    try {
        # Capture combined stdout+stderr
        $output = & $cmd $args 2>&1
        $exit = $LASTEXITCODE
    } catch {
        Fail "Failed to run command: $cmd $($args -join ' ') - $_"
    }
    # Append output to log
    if ($output) { Add-Content $logFile $output }
    # Print a short status to console
    if ($exit -ne 0) {
        Write-Host "Command failed (exit $exit): $cmd $($args -join ' ')" -ForegroundColor Red
        Write-Host "See log: $logFile" -ForegroundColor Yellow
        Fail "Command failed: $cmd $($args -join ' ') (Exit code: $exit)"
    }
    Write-Host "Command succeeded: $cmd" -ForegroundColor Green
    return $output
}

Write-Host "Starting safe SKU migration sequence" -ForegroundColor Green
Write-Host "Project root: $projectRoot"

# Parse CLI args for non-interactive / CI mode
$nonInteractive = $false
$ciMode = $false
foreach ($a in $args) {
    if ($a -eq '--confirm' -or $a -eq '--yes') { $nonInteractive = $true }
    if ($a -eq '--ci') { $nonInteractive = $true; $ciMode = $true }
}

# Prepare logs
$logsDir = Join-Path $projectRoot 'logs'
if (-Not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir | Out-Null }
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$logFile = Join-Path $logsDir "sku_migration_$timestamp.log"
Add-Content $logFile "SKU migration run started at $(Get-Date -Format o)"
Add-Content $logFile "CI mode: $ciMode; NonInteractive: $nonInteractive"

# 0) Basic prechecks
CheckFile $migration1
CheckFile $migration2
CheckFile $backfillScript
CheckFile $verifySql
CheckFile $prismaSchema
CheckFile $verifyNodeScript

# Ensure node and npx exist
if (-Not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail "Node.js is not available in PATH. Please install Node and ensure 'node' is available."
}
if (-Not (Get-Command npx -ErrorAction SilentlyContinue)) {
    Fail "npx is not available in PATH. Please install npm (Node) and ensure 'npx' is available."
}

# Helper to run prisma db execute (uses npx prisma db execute)
function Run-PrismaExecute([string]$sqlFile) {
    if (-Not (Test-Path $sqlFile)) { Fail "SQL file missing: $sqlFile" }
    $args = @('prisma','db','execute','--file', "$sqlFile", '--schema', "$prismaSchema")
    RunCmd 'npx' $args
}

# 1) Apply first migration (add nullable sku)
Write-Host "\n=== Step 1: Apply first migration (add nullable sku) ===" -ForegroundColor Yellow
Run-PrismaExecute $migration1
Write-Host "First migration applied." -ForegroundColor Green

# 2) Generate Prisma client
Write-Host "\n=== Step 2: Run 'npx prisma generate' ===" -ForegroundColor Yellow
RunCmd 'npx' @('prisma','generate','--schema',$prismaSchema)
Write-Host "Prisma client generated." -ForegroundColor Green

# 3) Run backfill script
Write-Host "\n=== Step 3: Run backfill script (node scripts/backfillSku.js) ===" -ForegroundColor Yellow
Write-Host "Running backfill script now. Output will be streamed below..." -ForegroundColor Cyan

# Run backfill script and capture output
Add-Content $logFile "\n=== Running backfill script ==="
try {
    # Capture stdout and stderr together for the backfill script
    $backfillOutput = & node $backfillScript 2>&1
    $backfillExit = $LASTEXITCODE
} catch {
    Fail "Failed to execute backfill script: $_"
}

Add-Content $logFile $backfillOutput
if ($backfillExit -ne 0) {
    Write-Host "Backfill script failed. See log: $logFile" -ForegroundColor Red
    Fail "Backfill script exited with code $backfillExit"
}

Write-Host "--- backfill output (last 200 lines) ---" -ForegroundColor Gray
$backfillOutput | Select-Object -Last 200 | ForEach-Object { Write-Host $_ }
Write-Host "Backfill script completed." -ForegroundColor Green

# 4) Automated verification step using Prisma Client (Node)
Write-Host "\n=== Step 4: Automated verification (ensure missing_sku = 0) ===" -ForegroundColor Yellow
CheckFile $verifyNodeScript

Write-Host "Running verification via Node/Prisma..." -ForegroundColor Cyan
try {
    if ($ciMode) {
        $verifyOutput = & node $verifyNodeScript '--ci'
    } else {
        $verifyOutput = & node $verifyNodeScript
    }
    $verifyExit = $LASTEXITCODE
} catch {
    Fail "Failed to execute verification script: $_"
}

if ($verifyExit -ne 0) {
    Write-Host "Verification script reported issues or failed." -ForegroundColor Red
    Write-Host "Output:" -ForegroundColor Gray
    $verifyOutput | ForEach-Object { Write-Host $_ }
    Add-Content $logFile "\n=== Verification output (failed) ==="
    Add-Content $logFile $verifyOutput
    Fail "Verification failed. Please inspect the output above and fix data before proceeding."
}

# Parse JSON output from verification script (stdout only)
$verifyJsonText = ($verifyOutput -join "`n").Trim()
try {
    $verifyResult = $verifyJsonText | ConvertFrom-Json
} catch {
    Write-Host "Failed to parse verification JSON output:" -ForegroundColor Red
    Write-Host $verifyJsonText
    Fail "Verification script produced invalid JSON. Aborting."
}

Write-Host "Verification passed checks:" -ForegroundColor Green
Write-Host "  totalOrderItems: $($verifyResult.totalOrderItems)" -ForegroundColor Gray
Write-Host "  missingSku: $($verifyResult.missingSku)" -ForegroundColor Gray
Write-Host "  itemIdColumnExists: $($verifyResult.itemIdColumnExists)" -ForegroundColor Gray
Write-Host "  itemIdColumnCount: $($verifyResult.itemIdColumnCount)" -ForegroundColor Gray
Write-Host "  fkCount: $($verifyResult.fkCount)" -ForegroundColor Gray


# Ask user to confirm proceeding with second migration
Write-Host "\nIMPORTANT: Ensure missing_sku = 0 before continuing. If you skipped verification above, run the SQL now and verify results." -ForegroundColor Magenta
$proceed = Read-Host "Proceed with second (destructive) migration to make sku NOT NULL and drop itemId? (Y/N) [N]"
if (-not ($proceed -match '^[Yy]')) {
    Write-Host "Aborting before second migration. No destructive changes applied." -ForegroundColor Yellow
    exit 0
}

# 5) Apply second migration (make sku NOT NULL, drop FK + itemId)
Write-Host "\n=== Step 5: Applying second migration (make sku NOT NULL, drop FK + itemId) ===" -ForegroundColor Yellow
Run-PrismaExecute $migration2
Write-Host "Second migration applied." -ForegroundColor Green

# 6) Generate Prisma client again
Write-Host "\n=== Step 6: Run 'npx prisma generate' again ===" -ForegroundColor Yellow
RunCmd 'npx' @('prisma','generate','--schema',$prismaSchema)
Write-Host "Prisma client generated (post-migration)." -ForegroundColor Green

# 7) Final automated verification using Prisma Client (Node)
Write-Host "\n=== Step 7: Final automated verification (post-migration) ===" -ForegroundColor Yellow
Write-Host "Running verification via Node/Prisma..." -ForegroundColor Cyan
try {
    $finalOutput = & node $verifyNodeScript 2>&1
    $finalExit = $LASTEXITCODE
} catch {
    Fail "Failed to execute final verification script: $_"
}

if ($finalExit -ne 0) {
    Write-Host "Final verification reported issues or failed." -ForegroundColor Red
    $finalOutput | ForEach-Object { Write-Host $_ }
    Fail "Final verification failed. Please inspect the output above."
}

$finalJsonText = ($finalOutput -join "`n").Trim()
try {
    $finalResult = $finalJsonText | ConvertFrom-Json
} catch {
    Write-Host "Failed to parse final verification JSON output:" -ForegroundColor Red
    Write-Host $finalJsonText
    Fail "Final verification script produced invalid JSON. Aborting."
}

Write-Host "Final verification passed checks:" -ForegroundColor Green
Write-Host "  totalOrderItems: $($finalResult.totalOrderItems)" -ForegroundColor Gray
Write-Host "  missingSku: $($finalResult.missingSku)" -ForegroundColor Gray
Write-Host "  itemIdColumnExists: $($finalResult.itemIdColumnExists)" -ForegroundColor Gray
Write-Host "  itemIdColumnCount: $($finalResult.itemIdColumnCount)" -ForegroundColor Gray
Write-Host "  fkCount: $($finalResult.fkCount)" -ForegroundColor Gray

Write-Host "\nMigration completed successfully." -ForegroundColor Green

Write-Host "\nSKU migration sequence complete. If you stopped before step 5, no destructive changes were applied." -ForegroundColor Green
Write-Host "Remember to remove or archive the migration SQL files only after you are satisfied with the results." -ForegroundColor Gray

exit 0
