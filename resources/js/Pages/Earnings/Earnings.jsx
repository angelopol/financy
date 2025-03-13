import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CreateEarningModal from './CreateEarningModal';
import Item from '@/components/Item';
import Pagination from '@/components/Pagination';
import { useState } from 'react';
import AmountConversionModal from '@/components/AmountConversionModal';
import { ConvertAmount } from '@/helpers/convertions.js';

export default function Earnings({ auth, OneTimeEarnings, RecurringEarnings, rates }) {
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
    RecurringEarnings.data.forEach((earning) => {
        items.push(<Item
            key={earning.id}
            item={earning}
            Route='earnings.update'
            DestroyRoute='earnings.destroy'
            openRatesModal={openRatesModal}
        />);
        amount += ConvertAmount(earning.amount, earning.currency, rates);
    });

    return (
        <AuthenticatedLayout
            user={auth}
            header={<h2 className="font-semibold text-xl text-gray-800 dark:text-gray-200 leading-tight">Earnings</h2>}
        >
            <Head title="Earnings" />

            <div className="py-12">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                        <div className="p-6">
                            {items}
                            <span className="text-sm text-gray-500 flex justify-end cursor-pointer" onClick={() => openRatesModal(amount, '$')}>Total amount: {amount}$</span>
                            <div>
                                <Pagination links={RecurringEarnings.links} />                               
                            </div>
                            {OneTimeEarnings.data.map((earning) => (
                                <Item
                                    key={earning.id}
                                    item={earning}
                                    Route='earnings.update'
                                    DestroyRoute='earnings.destroy'
                                    openRatesModal={openRatesModal}
                                />
                            ))}
                            <div className='pt-1 pb-2'>
                                <Pagination links={OneTimeEarnings.links} />
                            </div>
                            <CreateEarningModal />
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