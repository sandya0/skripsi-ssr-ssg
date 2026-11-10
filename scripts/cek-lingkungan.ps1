# Mencatat keadaan perangkat uji sebelum dan sesudah satu sesi pengukuran.
#
# Contoh:
#   powershell -ExecutionPolicy Bypass -File scripts/cek-lingkungan.ps1 -Sesi ulang-2 -Tahap sebelum
#   powershell -ExecutionPolicy Bypass -File scripts/cek-lingkungan.ps1 -Sesi ulang-2 -Tahap sesudah -SejakMenit 40
#
# Keluaran: results/<Sesi>/lingkungan-<Tahap>.txt
param(
    [Parameter(Mandatory = $true)][string]$Sesi,
    [ValidateSet('sebelum', 'sesudah')][string]$Tahap = 'sebelum',
    [int]$SejakMenit = 60
)

$folder = Join-Path 'results' $Sesi
New-Item -ItemType Directory -Force $folder | Out-Null
$berkas = Join-Path $folder "lingkungan-$Tahap.txt"
$baris = New-Object System.Collections.Generic.List[string]
function Tulis([string]$teks) { $baris.Add($teks) }

$os = Get-CimInstance Win32_OperatingSystem
Tulis "Sesi            : $Sesi ($Tahap)"
Tulis "Waktu           : $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz'))"
Tulis "Boot terakhir   : $($os.LastBootUpTime.ToString('yyyy-MM-dd HH:mm:ss'))"
Tulis "OS              : $($os.Caption) build $($os.BuildNumber)"
Tulis "Rencana daya    : $((powercfg /getactivescheme) -join ' ')"

$wu = Get-Service wuauserv -ErrorAction SilentlyContinue
Tulis "wuauserv        : $($wu.Status) (StartType $($wu.StartType))"
$ux = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings' -ErrorAction SilentlyContinue
Tulis "Jeda update s.d.: $($ux.PauseUpdatesExpiryTime)"

$cpu = 1..5 | ForEach-Object {
    (Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'").PercentProcessorTime
    Start-Sleep -Seconds 1
}
Tulis "Beban CPU (5 s) : $($cpu -join ', ') %"
Tulis ''

$pola = 'chrome|msedge|firefox|steam|discord|riot|league|vgc|onedrive|spotify|teams|epic|battle|whatsapp|crossdevice|phonelink|phoneexperience'
Tulis '== Proses aplikasi latar yang dipantau (mulai paling awal, total CPU) =='
$dipantau = Get-Process | Where-Object { $_.ProcessName -match $pola } |
    Group-Object ProcessName | ForEach-Object {
        $mulai = ($_.Group | Where-Object StartTime | Sort-Object StartTime | Select-Object -First 1).StartTime
        $teksMulai = if ($mulai) { $mulai.ToString('HH:mm:ss') } else { '?' }
        $cpuTotal = ($_.Group | Measure-Object CPU -Sum).Sum
        "{0,-30} x{1,-3} mulai {2}  CPU {3,7:N1} s" -f $_.Name, $_.Count, $teksMulai, $cpuTotal
    }
if ($dipantau) { $dipantau | ForEach-Object { Tulis $_ } } else { Tulis '(tidak ada)' }
Tulis ''

Tulis '== 15 proses dengan waktu CPU terbesar sejak mulai =='
Get-Process | Sort-Object CPU -Descending | Select-Object -First 15 | ForEach-Object {
    Tulis ("{0,-30} CPU {1,8:N1} s  RAM {2,6:N0} MB" -f $_.ProcessName, $_.CPU, ($_.WorkingSet64 / 1MB))
}
Tulis ''

Tulis "== Peristiwa Windows Update/servicing di log System, $SejakMenit menit terakhir =="
$sejak = (Get-Date).AddMinutes(-$SejakMenit)
try {
    $peristiwa = Get-WinEvent -FilterHashtable @{
        LogName = 'System'
        ProviderName = 'Microsoft-Windows-WindowsUpdateClient', 'Microsoft-Windows-Servicing'
        StartTime = $sejak
    } -ErrorAction Stop
    $peristiwa | ForEach-Object { Tulis ("{0}  {1}  {2}" -f $_.TimeCreated.ToString('HH:mm:ss'), $_.Id, $_.ProviderName) }
} catch {
    Tulis '(tidak ada)'
}

$baris | Out-File -FilePath $berkas -Encoding utf8
$baris | ForEach-Object { Write-Output $_ }
Write-Output "Disimpan: $berkas"
