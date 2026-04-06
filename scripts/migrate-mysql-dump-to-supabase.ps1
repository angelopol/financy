param(
    [Parameter(Mandatory = $true)]
    [string]$DumpPath,

    [Parameter(Mandatory = $true)]
    [string]$SupabaseHost,

    [Parameter(Mandatory = $true)]
    [string]$SupabasePassword,

    [string]$SupabaseUser = "postgres",
    [string]$SupabaseDatabase = "postgres",
    [int]$SupabasePort = 5432,

    [string]$SourceDatabase = "financy_legacy",
    [string]$MysqlContainerName = "financy-mysql-migration",
    [string]$DockerNetworkName = "financy-migration-net",
    [string]$MysqlRootPassword = "financyRoot123",

    [switch]$SkipVerification,
    [switch]$KeepMysqlContainer
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor Cyan
}

function Assert-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "No se encontro el comando requerido: $Name"
    }
}

function Invoke-Docker {
    param(
        [string[]]$Args,
        [switch]$IgnoreErrors,
        [switch]$CaptureOutput
    )

    if ($CaptureOutput) {
        $output = & docker @Args 2>&1
        if (-not $IgnoreErrors -and $LASTEXITCODE -ne 0) {
            throw "Fallo Docker: docker $($Args -join ' ')`n$output"
        }
        return $output
    }

    & docker @Args
    if (-not $IgnoreErrors -and $LASTEXITCODE -ne 0) {
        throw "Fallo Docker: docker $($Args -join ' ')"
    }
}

function Wait-ForMysql {
    param(
        [string]$Container,
        [string]$Password,
        [int]$TimeoutSeconds = 120
    )

    $start = Get-Date
    while (((Get-Date) - $start).TotalSeconds -lt $TimeoutSeconds) {
        & docker exec -e "MYSQL_PWD=$Password" $Container mysqladmin -uroot ping --silent *> $null
        if ($LASTEXITCODE -eq 0) {
            return
        }
        Start-Sleep -Seconds 2
    }

    throw "MySQL temporal no estuvo listo dentro de $TimeoutSeconds segundos."
}

Assert-Command -Name "docker"

if (-not (Test-Path -LiteralPath $DumpPath)) {
    throw "No se encontro el archivo dump: $DumpPath"
}

$resolvedDumpPath = (Resolve-Path -LiteralPath $DumpPath).Path
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$reportDir = Join-Path $projectRoot "storage\logs"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$reportPath = Join-Path $reportDir "supabase-row-count-check-$timestamp.csv"

if (-not (Test-Path -LiteralPath $reportDir)) {
    New-Item -Path $reportDir -ItemType Directory -Force | Out-Null
}

$networkAlreadyExists = $true
Invoke-Docker -Args @("network", "inspect", $DockerNetworkName) -IgnoreErrors
if ($LASTEXITCODE -ne 0) {
    $networkAlreadyExists = $false
    Write-Step "Creando red Docker $DockerNetworkName"
    Invoke-Docker -Args @("network", "create", $DockerNetworkName)
}

$pgloaderContainerName = "financy-pgloader-$([Guid]::NewGuid().ToString('N').Substring(0, 8))"
$pgloaderLoadFile = Join-Path $env:TEMP "financy-pgloader-$([Guid]::NewGuid().ToString('N')).load"

try {
    Write-Step "Eliminando contenedor MySQL temporal previo (si existe)"
    Invoke-Docker -Args @("rm", "-f", $MysqlContainerName) -IgnoreErrors

    Write-Step "Levantando MySQL temporal para restaurar el dump"
    Invoke-Docker -Args @(
        "run", "-d",
        "--name", $MysqlContainerName,
        "--network", $DockerNetworkName,
        "-e", "MYSQL_DATABASE=$SourceDatabase",
        "-e", "MYSQL_ROOT_PASSWORD=$MysqlRootPassword",
        "mysql:8.0",
        "--default-authentication-plugin=mysql_native_password",
        "--character-set-server=utf8mb4",
        "--collation-server=utf8mb4_unicode_ci"
    )

    Write-Step "Esperando disponibilidad de MySQL temporal"
    Wait-ForMysql -Container $MysqlContainerName -Password $MysqlRootPassword

    Write-Step "Copiando dump al contenedor temporal"
    Invoke-Docker -Args @("cp", $resolvedDumpPath, "$MysqlContainerName`:/tmp/source.sql")

    Write-Step "Importando dump MySQL"
    Invoke-Docker -Args @(
        "exec",
        "-e", "MYSQL_PWD=$MysqlRootPassword",
        $MysqlContainerName,
        "sh", "-lc",
        "mysql -uroot $SourceDatabase < /tmp/source.sql"
    )

    $escapedMysqlPassword = [System.Uri]::EscapeDataString($MysqlRootPassword)
    $escapedPgPassword = [System.Uri]::EscapeDataString($SupabasePassword)

    $pgloaderLoad = @"
LOAD DATABASE
    FROM mysql://root:$escapedMysqlPassword@$MysqlContainerName:3306/$SourceDatabase
    INTO postgresql://$SupabaseUser:$escapedPgPassword@$SupabaseHost:$SupabasePort/$SupabaseDatabase?sslmode=require

WITH include drop, create tables, create indexes, reset sequences, foreign keys, quote identifiers,
     workers = 4, concurrency = 1

SET maintenance_work_mem to '128 MB',
    work_mem to '12 MB',
    search_path to 'public';
"@

    Set-Content -LiteralPath $pgloaderLoadFile -Value $pgloaderLoad -Encoding ASCII

    Write-Step "Preparando contenedor de pgloader"
    Invoke-Docker -Args @(
        "create",
        "--name", $pgloaderContainerName,
        "--network", $DockerNetworkName,
        "dimitri/pgloader:latest",
        "pgloader",
        "/tmp/load.load"
    )

    Write-Step "Copiando plan de migracion a pgloader"
    Invoke-Docker -Args @("cp", $pgloaderLoadFile, "$pgloaderContainerName`:/tmp/load.load")

    Write-Step "Migrando de MySQL temporal a Supabase PostgreSQL"
    Invoke-Docker -Args @("start", "-a", $pgloaderContainerName)

    if (-not $SkipVerification) {
        Write-Step "Verificando integridad por conteo de filas"
        $tableNames = Invoke-Docker -CaptureOutput -Args @(
            "exec",
            "-e", "MYSQL_PWD=$MysqlRootPassword",
            $MysqlContainerName,
            "mysql", "-uroot", "-N", "-e",
            "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = '$SourceDatabase' ORDER BY TABLE_NAME;"
        )

        $comparison = @()

        foreach ($rawTable in $tableNames) {
            $table = "$rawTable".Trim()
            if ([string]::IsNullOrWhiteSpace($table)) {
                continue
            }

            $sourceRows = Invoke-Docker -CaptureOutput -Args @(
                "exec",
                "-e", "MYSQL_PWD=$MysqlRootPassword",
                $MysqlContainerName,
                "mysql", "-uroot", "-N", "-e",
                "SELECT COUNT(*) FROM \`$SourceDatabase\`.\`$table\`;"
            )

            $safeTable = $table.Replace('"', '""')
            $targetRowsRaw = Invoke-Docker -CaptureOutput -IgnoreErrors -Args @(
                "run", "--rm",
                "-e", "PGPASSWORD=$SupabasePassword",
                "postgres:16-alpine",
                "psql",
                "host=$SupabaseHost port=$SupabasePort dbname=$SupabaseDatabase user=$SupabaseUser sslmode=require",
                "-t", "-A", "-c",
                "SELECT COUNT(*) FROM public.\"$safeTable\";"
            )

            $sourceCount = [int64](($sourceRows | Select-Object -Last 1).ToString().Trim())
            $targetCountText = (($targetRowsRaw | Select-Object -Last 1).ToString().Trim())
            $targetCount = 0
            $status = "OK"

            if ($LASTEXITCODE -ne 0 -or -not [int64]::TryParse($targetCountText, [ref]$targetCount)) {
                $status = "TARGET_TABLE_ERROR"
                $targetCount = -1
            } elseif ($sourceCount -ne $targetCount) {
                $status = "MISMATCH"
            }

            $comparison += [pscustomobject]@{
                table = $table
                source_rows = $sourceCount
                target_rows = $targetCount
                status = $status
            }
        }

        $comparison | Export-Csv -LiteralPath $reportPath -NoTypeInformation -Encoding UTF8
        $comparison | Format-Table -AutoSize | Out-String | Write-Host

        $hasMismatch = $comparison | Where-Object { $_.status -ne "OK" }
        if ($hasMismatch) {
            throw "La verificacion encontro diferencias. Revisa el reporte: $reportPath"
        }

        Write-Step "Verificacion finalizada sin diferencias. Reporte: $reportPath"
    }

    Write-Step "Migracion completada correctamente"
}
finally {
    Write-Step "Limpieza de recursos temporales"
    if (Test-Path -LiteralPath $pgloaderLoadFile) {
        Remove-Item -LiteralPath $pgloaderLoadFile -Force -ErrorAction SilentlyContinue
    }

    Invoke-Docker -Args @("rm", "-f", $pgloaderContainerName) -IgnoreErrors

    if (-not $KeepMysqlContainer) {
        Invoke-Docker -Args @("rm", "-f", $MysqlContainerName) -IgnoreErrors
    }

    if (-not $networkAlreadyExists) {
        Invoke-Docker -Args @("network", "rm", $DockerNetworkName) -IgnoreErrors
    }
}
