# RUN / Allow 승인 대기 알림음 — 짧은 띵 한 번 (Windows, project hooks)
$ErrorActionPreference = "SilentlyContinue"

function Play-ApprovalAttentionSound {
  $wav = Join-Path $env:WINDIR "Media\Windows Notify.wav"
  if (Test-Path -LiteralPath $wav) {
    try {
      $player = New-Object System.Media.SoundPlayer $wav
      $player.PlaySync()
      return
    } catch {}
  }
  try {
    [console]::Beep(880, 120)
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
