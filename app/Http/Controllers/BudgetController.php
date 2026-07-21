<?php

namespace App\Http\Controllers;

use App\Models\BudgetCategory;
use App\Models\Expense;
use App\Models\MonthlyBudget;
use App\Support\SlugNormalizer;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class BudgetController extends Controller
{
    public function index(Request $request)
    {
        $monthInput = $request->query('month', now()->format('Y-m'));
        abort_unless(is_string($monthInput) && preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $monthInput), 422, 'Invalid budget month.');
        $month = Carbon::createFromFormat('Y-m', $monthInput)->startOfMonth();
        $budget = MonthlyBudget::firstOrCreate(['user_id' => auth()->id(), 'month' => $month->toDateString()]);
        $expenses = Expense::where('user', auth()->id())->whereNull('term')->whereNull('claim_day')
            ->whereBetween('created_at', [$month->copy()->startOfMonth(), $month->copy()->endOfMonth()])->get();
        $categories = $budget->categories->map(function ($category) use ($expenses) {
            $categoryWords = SlugNormalizer::words($category->slug);
            $spent = $expenses->filter(function ($expense) use ($categoryWords) {
                return count(array_intersect($categoryWords, SlugNormalizer::words($expense->slug))) > 0;
            })->sum('amount');

            return [...$category->toArray(), 'spent' => round($spent, 2), 'remaining' => round((float) $category->amount - $spent, 2)];
        });
        $availableSlugs = Expense::where('user', auth()->id())->whereNotNull('slug')->pluck('slug')
            ->flatMap(fn ($slug) => SlugNormalizer::words($slug))->unique()->sort()->values();

        return Inertia::render('Budgets/Budgets', [
            'auth' => auth()->user(), 'month' => $month->format('Y-m'),
            'categories' => $categories, 'availableSlugs' => $availableSlugs,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'month' => 'required|date_format:Y-m', 'name' => 'required|string|max:120',
            'amount' => 'required|numeric|min:0', 'slug' => 'required|array|min:1|max:30', 'slug.*' => 'string|max:60',
        ]);
        $budget = MonthlyBudget::firstOrCreate([
            'user_id' => auth()->id(), 'month' => Carbon::createFromFormat('Y-m', $validated['month'])->startOfMonth()->toDateString(),
        ]);
        $budget->categories()->create([
            'name' => $validated['name'], 'amount' => $validated['amount'],
            'slug' => SlugNormalizer::normalize($validated['slug']),
        ]);

        return back()->with('flash', ['type' => 'success', 'message' => 'Budget category created.']);
    }

    public function update(Request $request, BudgetCategory $category)
    {
        $this->authorizeCategory($category);
        $validated = $request->validate([
            'name' => 'required|string|max:120', 'amount' => 'required|numeric|min:0',
            'slug' => 'required|array|min:1|max:30', 'slug.*' => 'string|max:60',
        ]);
        $validated['slug'] = SlugNormalizer::normalize($validated['slug']);
        $category->update($validated);

        return back();
    }

    public function destroy(BudgetCategory $category)
    {
        $this->authorizeCategory($category);
        $category->delete();

        return back();
    }

    private function authorizeCategory(BudgetCategory $category): void
    {
        abort_unless((int) $category->budget->user_id === (int) auth()->id(), 403);
    }
}
