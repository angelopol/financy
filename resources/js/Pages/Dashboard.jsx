import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState } from 'react';
import AmountConversionModal from '@/components/AmountConversionModal';
import { Link } from '@inertiajs/react';

export default function Dashboard({ auth, rates, savings, box, ExpectedSavings, ExpectedBox }) {
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