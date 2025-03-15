import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useState } from 'react';
import AmountConversionModal from '@/components/AmountConversionModal';
import ShowItems from '@/components/ShowItems';
import { Inertia } from '@inertiajs/inertia';
import PrimaryButton from '@/components/PrimaryButton';

export default function Box({ auth, rates, RecurringEarnings, OneTimeEarnings, RecurringExpenses, OneTimeExpenses, ShopListItems, box, ExpectedSavings }) {
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

    const handleTransferClick = () => {
        Inertia.post(route('box.transfer'));
    };

    return (
        <AuthenticatedLayout
            user={auth}
            header={
                <h2 className="font-semibold text-xl text-gray-800 dark:text-gray-200 leading-tight">
                    Box <span className='text-green-200'>{box}$ {ExpectedSavings < 0 ? '-' : '+'} {Math.abs(ExpectedSavings)}$</span>
                </h2>
            }
        >
            <Head title="Box" />

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
                            <div className='flex justify-end mt-5'>
                                <PrimaryButton onClick={handleTransferClick}>
                                    Transfer
                                </PrimaryButton>
                            </div>
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