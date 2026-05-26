# 작업 완료(커밋·푸시 등) 알림음
$ErrorActionPreference = "SilentlyContinue"
$wav = Join-Path $env:WINDIR "Media\Windows Asterisk.wav"
if (Test-Path -LiteralPath $wav) {
  try {
    $player = New-Object System.Media.SoundPlayer $wav
    $player.PlaySync()
  } catch {}
}
try {
  [console]::Beep(880, 200)
  Start-Sleep -Milliseconds 100
  [console]::Beep(1100, 300)
} catch {}
