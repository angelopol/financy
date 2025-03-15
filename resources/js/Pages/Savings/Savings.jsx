import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useState } from 'react';
import AmountConversionModal from '@/components/AmountConversionModal';
import ShowItems from '@/components/ShowItems';

export default function Savings({ auth, rates, RecurringEarnings, OneTimeEarnings, RecurringExpenses, OneTimeExpenses, ShopListItems, savings, ExpectedSavings }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAmount, setSelectedAmount] = useState(0);
    const [selectedCurrency, setSelectedCurrency] = useState('$');
    const [activeTab, setActiveTab] = useState('earnings');

    const openRatesModal = (amount, currency) => {
        setSelectedAmount(amount);
        setSelectedCurrency(currency);
        setIsModalOpen(true);
    };

    const closeratesModal = () => {
        setIsModalOpen(false);
    };

    return (
        <AuthenticatedLayout
            user={auth}
            header={
                <h2 className="font-semibold text-xl text-gray-800 dark:text-gray-200 leading-tight">
                    Savings <span className='text-green-200'>{savings}$ {ExpectedSavings < 0 ? '-' : '+'} {Math.abs(ExpectedSavings)}$</span>
                </h2>
            }
        >
            <Head title="Savings" />

            <div className="py-12">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                        <div className="p-6">
                            <ShowItems
                                setActiveTab={setActiveTab}
                                activeTab={activeTab}
                                openRatesModal={openRatesModal}
                                RecurringEarnings={RecurringEarnings}
                                OneTimeEarnings={OneTimeEarnings}
                                RecurringExpenses={RecurringExpenses}
                                OneTimeExpenses={OneTimeExpenses}
                                ShopListItems={ShopListItems}
                            />
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