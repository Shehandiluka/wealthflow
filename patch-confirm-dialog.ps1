# WealthFlow project folder එක ඇතුළේ run කරන්න.
# Draft එකේ තියෙන suggested wallet එක Review & Confirm dialog එකේ default විදිහට තෝරන්න patch කරයි.
$f = Join-Path (Get-Location) "src\components\sms\ConfirmSmsDialog.tsx"
if (-not (Test-Path $f)) { Write-Host "ConfirmSmsDialog.tsx හම්බුණේ නැහැ - wealth-weaver folder එක ඇතුළේ run කරන්න."; exit 1 }
$t = [IO.File]::ReadAllText($f)
if ($t -match "suggested_account_id") { Write-Host "දැනටමත් patch කරලා තියෙනවා."; exit 0 }
$pattern = '// Best-effort account match by ref\s+if \(sms\.parsed_account_ref && accounts\.length\) \{'
if (([regex]::Matches($t, $pattern)).Count -ne 1) { Write-Host "අපේක්ෂිත කේත කොටස හම්බුණේ නැහැ - වෙනස් නොකර නතර කළා."; exit 1 }
$new = @'
// Prefer the wallet the draft already suggests (Telegram bot / auto-post)
    const suggestedId = (sms as any).suggested_account_id as string | null | undefined;
    if (suggestedId && accounts.some(a => a.id === suggestedId)) {
      setAccountId(suggestedId);
    } else if (sms.parsed_account_ref && accounts.length) {
'@
Copy-Item $f "$f.bak" -Force
$t2 = [regex]::Replace($t, $pattern, $new.TrimEnd("`r", "`n"))
[IO.File]::WriteAllText($f, $t2)
Write-Host "Patch කළා. (පරණ එක ConfirmSmsDialog.tsx.bak ලෙස සේව් කළා)"
