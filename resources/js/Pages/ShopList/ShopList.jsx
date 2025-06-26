import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CreateShopListItemModal from './CreateShopListItemModal';
import Item from '@/components/Item';
import Pagination from '@/components/Pagination';
import { useState } from 'react';
import AmountConversionModal from '@/components/AmountConversionModal';

export default function ShopList({ auth, ShopListItems, TotalAmount, rates }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAmount, setSelectedAmount] = useState(0);
    const [selectedCurrency, setSelectedCurrency] = useState('$');

    const openRatesModal = (amount, currency) => {
        setSelectedAmount(amount);
        setSelectedCurrency(currency);
        setIsModalOpen(true);
    };

    const closeratesModal = () => {
        setIsModalOpen(false);
    };

    const items = [];
    let amount = 0;
    ShopListItems.data.forEach((item) => {
        items.push(<Item
            key={item.id}
            item={item}
            Route='shoplist.update'
            DestroyRoute='shoplist.destroy'
            openRatesModal={openRatesModal}
        />);
        amount += parseFloat(item.amount);
    });

    return (
        <AuthenticatedLayout
            user={auth}
            header={<h2 className="font-semibold text-xl text-gray-800 dark:text-gray-200 leading-tight">Shop list</h2>}
        >
            <Head title="Shop list" />

            <div className="py-12">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                        <div className="p-6">
                            {items}
                            {ShopListItems.data.length > 0 && (
                                <>
                                    <span className="text-sm text-gray-500 flex justify-end cursor-pointer mb-2" onClick={() => openRatesModal(amount, '$')}>Total amount current page: {amount.toFixed(2)}$</span>
                                    <span className="text-sm text-gray-500 flex justify-end cursor-pointer mb-2" onClick={() => openRatesModal(TotalAmount, '$')}>Total amount pending: {TotalAmount.toFixed(2)}$</span>
                                    <div>
                                        <Pagination links={ShopListItems.links} />
                                    </div>
                                </>
                            )}
                            <br />
                            <CreateShopListItemModal />
                        </div>
                    </div>
                </div>
            </div>
            <AmountConversionModal
                isOpen={isModalOpen}
                onClose={closeratesModal}
                amount={selectedAmount}
                currency={selectedCurrency}
                rates={rates}
            />
        </AuthenticatedLayout>
    );
}