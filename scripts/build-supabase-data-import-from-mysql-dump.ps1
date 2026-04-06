param(
    [string]$InputDumpPath = ".\u619022423_financy.sql",
    [string]$OutputSqlPath = ".\database\supabase\financy-data-import.sql"
)

$ErrorActionPreference = "Stop"

function Assert-PathExists {
    param([string]$PathToCheck)

    if (-not (Test-Path -LiteralPath $PathToCheck)) {
        throw "No se encontro el archivo requerido: $PathToCheck"
    }
}

Assert-PathExists -PathToCheck $InputDumpPath

$sourceLines = Get-Content -LiteralPath $InputDumpPath -Encoding UTF8
$insertStatements = @()
$currentStatement = New-Object System.Text.StringBuilder
$isCapturingInsert = $false

foreach ($line in $sourceLines) {
    if (-not $isCapturingInsert) {
        if ($line -match '^\s*INSERT INTO\s+`([^`]+)`') {
            $isCapturingInsert = $true
            [void]$currentStatement.AppendLine($line)

            if ($line.TrimEnd().EndsWith(';')) {
                $insertStatements += $currentStatement.ToString().Trim()
                $currentStatement = New-Object System.Text.StringBuilder
                $isCapturingInsert = $false
            }
        }

        continue
    }

    [void]$currentStatement.AppendLine($line)

    if ($line.TrimEnd().EndsWith(';')) {
        $insertStatements += $currentStatement.ToString().Trim()
        $currentStatement = New-Object System.Text.StringBuilder
        $isCapturingInsert = $false
    }
}

if ($insertStatements.Count -eq 0) {
    throw "No se encontraron sentencias INSERT en el dump MySQL."
}

$statementsByTable = @{}
$tablesWithId = New-Object System.Collections.Generic.HashSet[string]

foreach ($statement in $insertStatements) {
    if (-not ($statement -match '^\s*INSERT INTO\s+`([^`]+)`\s*\(([^)]*)\)\s*VALUES')) {
        continue
    }

    $tableName = $matches[1]
    $columnsRaw = $matches[2]

    $convertedStatement = $statement -replace '`', '"'

    if (-not $statementsByTable.ContainsKey($tableName)) {
        $statementsByTable[$tableName] = New-Object System.Collections.Generic.List[string]
    }

    [void]$statementsByTable[$tableName].Add($convertedStatement)

    if ($columnsRaw -match '(^|,\s*)`id`(\s*,|$)') {
        [void]$tablesWithId.Add($tableName)
    }
}

if ($statementsByTable.Count -eq 0) {
    throw "No se pudieron clasificar las sentencias INSERT del dump."
}

$preferredOrder = @(
    'users',
    'password_reset_tokens',
    'failed_jobs',
    'migrations',
    'personal_access_tokens',
    'savings',
    'boxes',
    'shop_list_items',
    'earnings',
    'expenses',
    'movements'
)

$orderedTables = New-Object System.Collections.Generic.List[string]

foreach ($table in $preferredOrder) {
    if ($statementsByTable.ContainsKey($table)) {
        [void]$orderedTables.Add($table)
    }
}

$remainingTables = $statementsByTable.Keys | Where-Object { $orderedTables -notcontains $_ } | Sort-Object
foreach ($table in $remainingTables) {
    [void]$orderedTables.Add($table)
}

$outputDirectory = Split-Path -Path $OutputSqlPath -Parent
if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -Path $outputDirectory -ItemType Directory -Force | Out-Null
}

$builder = New-Object System.Text.StringBuilder
[void]$builder.AppendLine('-- SQL de importacion para Supabase PostgreSQL generado desde dump MySQL')
[void]$builder.AppendLine('-- Generado por scripts/build-supabase-data-import-from-mysql-dump.ps1')
[void]$builder.AppendLine(('-- Fecha: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')))
[void]$builder.AppendLine()
[void]$builder.AppendLine('BEGIN;')
[void]$builder.AppendLine()

foreach ($table in $orderedTables) {
    [void]$builder.AppendLine(('-- Tabla: {0}' -f $table))

    foreach ($stmt in $statementsByTable[$table]) {
        [void]$builder.AppendLine($stmt)
        [void]$builder.AppendLine()
    }
}

[void]$builder.AppendLine('-- Ajuste de secuencias para columnas id')

$idResetOrder = $orderedTables | Where-Object { $tablesWithId.Contains($_) }
foreach ($table in $idResetOrder) {
    [void]$builder.AppendLine('SELECT setval(s.seq_name, s.max_id, true)')
    [void]$builder.AppendLine('FROM (')
    [void]$builder.AppendLine(('  SELECT pg_get_serial_sequence(''"{0}"'', ''id'') AS seq_name,' -f $table))
    [void]$builder.AppendLine(('         COALESCE((SELECT MAX("id") FROM "{0}"), 1) AS max_id' -f $table))
    [void]$builder.AppendLine(') AS s')
    [void]$builder.AppendLine('WHERE s.seq_name IS NOT NULL;')
    [void]$builder.AppendLine()
}

[void]$builder.AppendLine('COMMIT;')

Set-Content -LiteralPath $OutputSqlPath -Value $builder.ToString() -Encoding UTF8

Write-Output ("Archivo generado: {0}" -f (Resolve-Path -LiteralPath $OutputSqlPath))
Write-Output ("Tablas procesadas: {0}" -f ($orderedTables -join ', '))
Write-Output ("Total INSERTs procesados: {0}" -f $insertStatements.Count)
