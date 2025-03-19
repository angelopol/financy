import Item from '@/components/Item.jsx';
import Pagination from '@/components/Pagination';
import PrimaryButton from '@/components/PrimaryButton';
import { Link } from '@inertiajs/react';

function renderItems(Items, openRatesModal) {
    const items = [];
    Items.data.forEach((element) => {
        let UpdateRoute = 'earnings.update';
        let DestroyRoute = 'earnings.destroy';
        if(element.currency == null && element.status == null) {
            UpdateRoute = 'expenses.update';
            DestroyRoute = 'expenses.destroy';
        } else if(element.currency == null && element.status != null) {
            UpdateRoute = 'shoplist.update';
            DestroyRoute = 'shoplist.destroy';
        }
        items.push(<Item
            key={element.id}
            item={element}
            Route={UpdateRoute}
            DestroyRoute={DestroyRoute}
            openRatesModal={openRatesModal}
        />);
    });

    return (
        <>
            {items}
            {Items.data.length > 0 && (
                <div className="p-1">
                    <Pagination links={Items.links} />
                </div>
            )}
        </>
    );
}

export default function ShowItems({ setActiveTab, activeTab, openRatesModal, RecurringEarnings, OneTimeEarnings, RecurringExpenses, OneTimeExpenses, ShopListItems }) {
    return (
        <>
            <nav className="flex space-x-4">
                <button
                    className={`px-3 py-2 ${activeTab === 'earnings' ? 'text-blue-500' : 'text-gray-500'}`}
                    onClick={() => setActiveTab('earnings')}
                >
                    Earnings
                </button>
                <button
                    className={`px-3 py-2 ${activeTab === 'expenses' ? 'text-blue-500' : 'text-gray-500'}`}
                    onClick={() => setActiveTab('expenses')}
                >
                    Expenses
                </button>
                <button
                    className={`px-3 py-2 ${activeTab === 'shopListItems' ? 'text-blue-500' : 'text-gray-500'}`}
                    onClick={() => setActiveTab('shopListItems')}
                >
                    Shop List Items
                </button>
            </nav>
            <div className="mt-4">
                {activeTab === 'earnings' && (
                    <>
                        {renderItems(RecurringEarnings, openRatesModal)}
                        {renderItems(OneTimeEarnings, openRatesModal)}
                        <Link className="flex justify-end mt-4" href={route('earnings.index')}>
                            <PrimaryButton>
                                ADD EARNING TO SAVINGS
                            </PrimaryButton>
                        </Link>
                    </>
                )}
                {activeTab === 'expenses' && (
                    <>
                        {renderItems(RecurringExpenses, openRatesModal)}
                        {renderItems(OneTimeExpenses, openRatesModal)}
                        <Link className="flex justify-end mt-4" href={route('expenses.index')}>
                            <PrimaryButton>
                                ADD EXPENSE TO SAVINGS
                            </PrimaryButton>
                        </Link>
                    </>
                )}
                {activeTab === 'shopListItems' && (
                    <>
                        {renderItems(ShopListItems, openRatesModal)}
                        <Link className="flex justify-end mt-4" href={route('shoplist.index')}>
                            <PrimaryButton>
                                ADD SHOP LIST ITEM TO SAVINGS
                            </PrimaryButton>
                        </Link>
                    </>
                )}
            </div>
        </>
    );
}