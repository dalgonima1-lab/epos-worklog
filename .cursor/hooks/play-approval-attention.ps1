# RUN / Allow 승인 대기 알림음 (Windows, project hooks)
$ErrorActionPreference = "SilentlyContinue"

try {
  $null = [Console]::In.ReadToEnd()
} catch {}

function Play-ApprovalAttentionSound {
  $wav = Join-Path $env:WINDIR "Media\Windows Exclamation.wav"
  if (Test-Path -LiteralPath $wav) {
    try {
      $player = New-Object System.Media.SoundPlayer $wav
      $player.PlaySync()
    } catch {}
  }
  try {
    [void][System.Media.SystemSounds]::Exclamation.Play()
  } catch {}
  try {
    [console]::Beep(523, 200)
    Start-Sleep -Milliseconds 90
    [console]::Beep(440, 200)
    Start-Sleep -Milliseconds 90
    [console]::Beep(523, 280)
  } catch {}
}

$debouncePath = Join-Path $env:TEMP "cursor-approval-attention-sound.txt"
$now = Get-Date
$shouldPlay = $true
if (Test-Path -LiteralPath $debouncePath) {
  try {
    $last = [datetime](Get-Content -LiteralPath $debouncePath -Raw -ErrorAction Stop)
    if (($now - $last).TotalMilliseconds -lt 400) { $shouldPlay = $false }
  } catch {}
}
if ($shouldPlay) {
  $now.ToString("o") | Set-Content -LiteralPath $debouncePath -NoNewline -Encoding utf8
  Play-ApprovalAttentionSound
}

Write-Output '{"continue":true}'
exit 0
