<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use App\Models\Movement;
use App\Models\ShopListItem;
use App\Services\ExchangeRateService;
use App\Services\FinanceAccountService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class ShopListController extends Controller
{
    public function index()
    {
        return Inertia::render('ShopList/ShopList', [
            'auth' => auth()->user(),
            'ShopListItems' => ShopListItem::where('user', auth()->id())
                ->orderByRaw("CASE WHEN status = 'pending' THEN 0 ELSE 1 END")->latest()->paginate(10),
            'TotalAmount' => ShopListItem::where('user', auth()->id())->where('status', 'pending')->sum('amount'),
            'rates' => EarningsController::GetRates(),
        ]);
    }

    public function store(Request $request, ExchangeRateService $rates)
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0',
            'description' => 'required|string|max:500',
            'currency' => 'required|string|in:$,bs,$bcv,$parallel,€',
        ]);
        $validated['user'] = auth()->id();
        $validated['status'] = 'pending';
        $validated['amount'] = $rates->toDollars($validated['currency'], (float) $validated['amount']);
        unset($validated['currency']);
        ShopListItem::create($validated);

        return back();
    }

    public function update(Request $request, ShopListItem $ShopListItem, ExchangeRateService $rates)
    {
        $this->authorize('update', $ShopListItem);
        $validated = $request->validate([
            'amount' => 'sometimes|numeric|min:0',
            'description' => 'sometimes|string|max:500',
            'currency' => 'sometimes|string|in:$,bs,$bcv,$parallel,€',
        ]);
        if (isset($validated['amount'])) {
            $validated['amount'] = $rates->toDollars($validated['currency'] ?? '$', (float) $validated['amount']);
        }
        unset($validated['currency']);
        $ShopListItem->update($validated);

        return back();
    }

    public function destroy(ShopListItem $ShopListItem)
    {
        $this->authorize('delete', $ShopListItem);
        $ShopListItem->delete();

        return back();
    }

    public function purchase(Request $request, ShopListItem $ShopListItem, FinanceAccountService $accounts)
    {
        $this->authorize('purchased', $ShopListItem);
        $validated = $request->validate([
            'provider' => 'required|string|in:box,savings,auto',
            'amount' => 'required|numeric|min:0',
            'not_discount' => 'nullable|boolean',
        ]);

        DB::transaction(function () use ($request, $ShopListItem, $validated, $accounts) {
            $notDiscount = $request->boolean('not_discount');
            $provider = $validated['provider'] === 'auto' ? $accounts->chooseProvider(auth()->id()) : $validated['provider'];
            $ShopListItem->update([
                'provider' => $notDiscount ? null : $provider,
                'amount' => (float) $validated['amount'],
                'status' => 'purchased',
                'not_discount' => $notDiscount,
            ]);
            if ($notDiscount) {
                return;
            }

            $provider = $accounts->debit(auth()->id(), $validated['provider'], (float) $validated['amount']);
            $ShopListItem->update(['provider' => $provider]);
            $expense = Expense::create([
                'user' => auth()->id(),
                'shop_list_item_id' => $ShopListItem->id,
                'description' => $ShopListItem->description,
                'amount' => (float) $validated['amount'],
                'provider' => $provider,
                'recurrence_type' => 'one_time',
            ]);
            Movement::create([
                'user' => auth()->id(), 'type' => 'expense', 'reference_id' => $expense->id,
                'description' => $expense->description, 'amount' => $expense->amount, 'provider' => $expense->provider,
            ]);
        });

        return back()->with('flash', app(ExpensesController::class)->limitFlash($request, 'Purchase registered.'));
    }

    public function gift(ShopListItem $ShopListItem)
    {
        $this->authorize('gift', $ShopListItem);
        $ShopListItem->update(['provider' => null, 'status' => 'purchased', 'not_discount' => true]);

        return back();
    }

    public function pending(ShopListItem $ShopListItem, FinanceAccountService $accounts)
    {
        $this->authorize('pending', $ShopListItem);
        DB::transaction(function () use ($ShopListItem, $accounts) {
            if ($ShopListItem->expense && ! $ShopListItem->not_discount) {
                $accounts->credit(auth()->id(), $ShopListItem->expense->provider, (float) $ShopListItem->expense->amount);
                Movement::where('type', 'expense')->where('reference_id', $ShopListItem->expense->id)->delete();
                $ShopListItem->expense->delete();
            }
            $ShopListItem->update(['provider' => null, 'status' => 'pending', 'not_discount' => false]);
        });

        return back();
    }
}
