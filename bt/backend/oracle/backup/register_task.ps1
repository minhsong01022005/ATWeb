# Chay bang PowerShell Run as Administrator. Dang ky backup RMAN hang tuan (Chu nhat 02:00).
$bat = Join-Path $PSScriptRoot "weekly.bat"
$a = New-ScheduledTaskAction -Execute $bat
$t = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 2am
$s = New-ScheduledTaskSettingsSet -StartWhenAvailable
Register-ScheduledTask -TaskName "RMAN Weekly Backup" -Action $a -Trigger $t -Settings $s -RunLevel Highest -Force
