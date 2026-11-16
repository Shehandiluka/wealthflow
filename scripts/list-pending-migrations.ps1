$ErrorActionPreference = "Stop"

$applied = @()
if (Test-Path "applied_versions.txt") {
    $applied = Get-Content "applied_versions.txt" | Where-Object { $_.Trim() -ne "" }
}

$localFiles = Get-ChildItem -Path "supabase\migrations" -Filter "*.sql" | Sort-Object Name

$pending = @()
foreach ($f in $localFiles) {
    $version = ($f.Name -split "_")[0]
    if ($applied -notcontains $version) {
        $pending += $f.Name
    }
}

if ($pending.Count -gt 0) {
    $pending | Set-Content "pending_migrations.txt"
} else {
    if (Test-Path "pending_migrations.txt") { Remove-Item "pending_migrations.txt" }
    New-Item -Path "pending_migrations.txt" -ItemType File | Out-Null
}
