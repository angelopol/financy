import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CreateExpensesModal from './CreateExpensesModal';
import Item from '@/components/Item';
import Pagination from '@/components/Pagination';
import { useState } from 'react';
import AmountConversionModal from '@/components/AmountConversionModal';

export default function Expenses({ auth, RecurringExpenses, OneTimeExpenses, rates }) {
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
    RecurringExpenses.data.forEach((expense) => {
        items.push(<Item
            key={expense.id}
            item={expense}
            Route='expenses.update'
            DestroyRoute='expenses.destroy'
            openRatesModal={openRatesModal}
        />);
        amount += parseFloat(expense.amount);
    });

    return (
        <AuthenticatedLayout
            user={auth}
            header={<h2 className="font-semibold text-xl text-gray-800 dark:text-gray-200 leading-tight">Expenses</h2>}
        >
            <Head title="Expenses" />

            <div className="py-12">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                        <div className="p-6">
                            {items}
                            {RecurringExpenses.data.length > 0 && (
                                <>
                                    <div className="p-1">
                                        <Pagination links={RecurringExpenses.links} />
                                    </div>
                                    <span className="text-sm text-gray-500 flex justify-end cursor-pointer" onClick={() => openRatesModal(amount, '$')}>Total amount: {amount.toFixed(2)}$</span>
                                </>
                            )}
                            {OneTimeExpenses.data.map((expense) => (
                                <Item
                                    key={expense.id}
                                    item={expense}
                                    Route='expenses.update'
                                    DestroyRoute='expenses.destroy'
                                    openRatesModal={openRatesModal}
                                />
                            ))}
                            {OneTimeExpenses.data.length > 0 && (
                                <div className='pt-1'>
                                    <Pagination links={OneTimeExpenses.links} />
                                </div>
                            )}
                            <br />
                            <CreateExpensesModal />
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