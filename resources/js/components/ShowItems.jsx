import Item from '@/components/Item.jsx';
import Pagination from '@/components/Pagination';
import PrimaryButton from '@/components/PrimaryButton';
import { Inertia } from '@inertiajs/inertia';

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

const handleAddMoneyClick = (Route) => {
    Inertia.get(route(Route));
};

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
                        <div className="flex justify-end mt-4">
                            <PrimaryButton
                                onClick={() => handleAddMoneyClick('earnings.index')}
                            >
                                ADD EARNING TO SAVINGS
                            </PrimaryButton>
                        </div>
                    </>
                )}
                {activeTab === 'expenses' && (
                    <>
                        {renderItems(RecurringExpenses, openRatesModal)}
                        {renderItems(OneTimeExpenses, openRatesModal)}
                        <div className="flex justify-end mt-4">
                            <PrimaryButton
                                onClick={() => handleAddMoneyClick('expenses.index')}
                            >
                                ADD EXPENSE TO SAVINGS
                            </PrimaryButton>
                        </div>
                    </>
                )}
                {activeTab === 'shopListItems' && (
                    <>
                        {renderItems(ShopListItems, openRatesModal)}
                        <div className="flex justify-end mt-4">
                            <PrimaryButton
                                onClick={() => handleAddMoneyClick('shoplist.index')}
                            >
                                ADD SHOP LIST ITEM TO SAVINGS
                            </PrimaryButton>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}