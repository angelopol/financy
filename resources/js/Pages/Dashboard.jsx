import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState } from 'react';
import AmountConversionModal from '@/components/AmountConversionModal';
import { Link } from '@inertiajs/react';

export default function Dashboard({ auth, rates, savings, box, ExpectedSavings, ExpectedBox, expenseLimit }) {
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

    return (
        <AuthenticatedLayout
            user={auth}
            header={<h2 className="font-semibold text-xl text-gray-800 dark:text-gray-200 leading-tight">Dashboard</h2>}
        >
            <Head title="Dashboard" />

            <div className="py-12">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                            <div className="p-6 text-gray-900 dark:text-gray-100">
                                <Link href={route('savings.show')}>
                                    <h3 className="text-lg font-semibold">Savings</h3>
                                </Link>
                                <p className="text-2xl mt-2">
                                    <span onClick={() => openRatesModal(savings, '$')}>{savings}$</span> 
                                    <span onClick={() => openRatesModal(parseFloat(savings)+parseFloat(ExpectedSavings), '$')}>{ExpectedSavings < 0 ? '-' : '+'} {Math.abs(ExpectedSavings)}$</span>
                                </p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                            <div className="p-6 text-gray-900 dark:text-gray-100">
                                <Link href={route('box.show')}>
                                    <h3 className="text-lg font-semibold">Box</h3>
                                </Link>
                                <p className="text-2xl mt-2">
                                    <span onClick={() => openRatesModal(box, '$')}>{box}$</span> 
                                    <span onClick={() => openRatesModal(parseFloat(box)+parseFloat(ExpectedBox), '$')}>{ExpectedBox < 0 ? '-' : '+'} {Math.abs(ExpectedBox)}$</span>
                                </p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                            <div className="p-6 text-gray-900 dark:text-gray-100">
                                <h3 className="text-lg font-semibold">Total</h3>
                                <p className="text-2xl mt-2">
                                    <span onClick={() => openRatesModal(parseFloat(box)+parseFloat(savings), '$')}>{(parseFloat(box)+parseFloat(savings)).toFixed(2)}$</span> 
                                    <span onClick={() => openRatesModal(parseFloat(savings)+parseFloat(ExpectedSavings)+parseFloat(box)+parseFloat(ExpectedBox), '$')}>
                                        {parseFloat(ExpectedBox)+parseFloat(ExpectedSavings) < 0 ? '-' : '+'} {Math.abs(parseFloat(ExpectedBox)+parseFloat(ExpectedSavings)).toFixed(2)}$
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>
                    {Number(expenseLimit?.limit || 0) > 0 && <div className="mt-6 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                        <div className="mb-2 flex justify-between"><h3 className="font-semibold">Monthly expense limit</h3><span>{Number(expenseLimit.spent).toFixed(2)}$ / {Number(expenseLimit.limit).toFixed(2)}$</span></div>
                        <div className="h-4 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"><div className={`h-full transition-all ${expenseLimit.percentage < 50 ? 'bg-green-500' : expenseLimit.percentage < 80 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, expenseLimit.percentage)}%` }} /></div>
                        <p className="mt-2 text-sm text-gray-500">{Number(expenseLimit.percentage).toFixed(1)}% used this month</p>
                        {expenseLimit.percentage > 100 && <p className="mt-2 font-semibold text-red-500">You have exceeded your monthly expense limit.</p>}
                    </div>}
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
