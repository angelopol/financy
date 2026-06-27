<?php

namespace App\Support;

use Illuminate\Http\Request;

class ProjectFinanceContext
{
    public function id(Request $request = null): ?int
    {
        $request ??= request();

        $projectId = $request->input('project_id')
            ?? $request->query('project_id')
            ?? $request->header('X-Project-Id');

        return $projectId ? (int) $projectId : null;
    }

    public function apply($query, Request $request = null)
    {
        $projectId = $this->id($request);

        if ($projectId) {
            return $query->where('project_id', $projectId);
        }

        return $query->where('user', auth()->id())->whereNull('project_id');
    }
}
