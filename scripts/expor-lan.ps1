# ============================================================
# Verifica/libera a porta 3000 no firewall do Windows para que
# dispositivos da rede local alcancem a aplicação que roda no WSL.
#
# PRÉ-REQUISITO: WSL2 em modo espelhado — adicionar ao C:\Users\<SEU_USUARIO>\.wslconfig:
#   [wsl2]
#   networkingMode=mirrored
# Depois executar (no PowerShell do Windows): wsl --shutdown
# e reabrir o terminal WSL. O IP usado passa a ser o IP de LAN do Windows.
#
# USO (no Windows, como Administrador):
#   powershell -ExecutionPolicy Bypass -File scripts\expor-lan.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$port = 3000

# Elevação para administrador (necessária para regras de firewall)
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Elevando para Administrador..." -ForegroundColor Yellow
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

# IPs de LAN ativos (ignora loopback, APIPA e adaptadores virtuais)
$ips = Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Dhcp,Manual |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.IPAddress -notlike "172.*" -and $_.IPAddress -notlike "10.*" -and $_.IPAddress -notlike "192.168.137.*" } |
    Select-Object -ExpandProperty IPAddress

if (-not $ips) {
    Write-Host "Nenhum IP de rede local (DHCP/estático) encontrado." -ForegroundColor Red
    exit 1
}
$lanIp = $ips[0]

# Regra de firewall (idempotente)
$ruleName = "Next.js $port (WSL mirrored)"
if (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue) {
    Write-Host "[OK] Regra de firewall ja existe: $ruleName" -ForegroundColor Green
} else {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $port | Out-Null
    Write-Host "[OK] Regra de firewall criada: $ruleName (porta $port)" -ForegroundColor Green
}

# Verifica convidados (listen) do serviço
$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    Write-Host "[OK] Servico escutando na porta $port" -ForegroundColor Green
} else {
    Write-Host "[ATENCAO] Nada escutando na porta $port ainda. Inicie o servidor no WSL (npm run dev) e rode o script de novo." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Acesse de outros dispositivos da rede local (Windows + WSL em modo espelhado):" -ForegroundColor Cyan
Write-Host "    http://$lanIp`:$port" -ForegroundColor White
Write-Host ""
Write-Host "OBS: cadastre exatamente http://$lanIp`:$port/api/auth/callback como redirect URI no" -ForegroundColor Yellow
Write-Host "Portal do Desenvolvedor Conta Azul (somente para app de PRODUÇÃO; no fluxo de dev," -ForegroundColor Yellow
Write-Host "a URL registrada e a troca manual de codigo ja funcionam de qualquer dispositivo)." -ForegroundColor Yellow