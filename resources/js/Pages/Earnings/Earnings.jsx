import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CreateEarningModal from './CreateEarningModal';
import Item from '@/components/Item';
import Pagination from '@/components/Pagination';
import { useState } from 'react';
import AmountConversionModal from '@/components/AmountConversionModal';
import { ConvertAmount } from '@/helpers/convertions.js';
import PrimaryButton from '@/components/PrimaryButton';
import DateRangeReportModal from '@/components/DateRangeReportModal';

export default function Earnings({ auth, OneTimeEarnings, RecurringEarnings, rates }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAmount, setSelectedAmount] = useState(0);
    const [selectedCurrency, setSelectedCurrency] = useState('$');
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportFrom, setReportFrom] = useState('');
    const [reportTo, setReportTo] = useState('');
    const [reportProvider, setReportProvider] = useState('both');
    
    const openRatesModal = (amount, currency) => {
        setSelectedAmount(amount);
        setSelectedCurrency(currency);
        setIsModalOpen(true);
    };

    const closeratesModal = () => {
        setIsModalOpen(false);
    };
    const openReportModal = () => setIsReportModalOpen(true);
    const closeReportModal = () => setIsReportModalOpen(false);
    const applyReportRange = ({ from, to, provider }) => {
        setReportFrom(from);
        setReportTo(to);
        setReportProvider(provider || 'both');
        setIsReportModalOpen(false);
        const params = new URLSearchParams();
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        if (provider && provider !== 'both') params.set('provider', provider);
        window.location.href = route('reports.earnings') + (params.toString() ? `?${params.toString()}` : '');
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
                            {RecurringEarnings.data.length > 0 && (
                                <>
                                    <span className="text-sm text-gray-500 flex justify-end cursor-pointer" onClick={() => openRatesModal(amount, '$')}>
                                        Total amount: {amount.toFixed(2)}$
                                    </span>
                                    <div>
                                        <Pagination links={RecurringEarnings.links} />                               
                                    </div>
                                </>
                            )}
                            {OneTimeEarnings.data.map((earning) => (
                                <Item
                                    key={earning.id}
                                    item={earning}
                                    Route='earnings.update'
                                    DestroyRoute='earnings.destroy'
                                    openRatesModal={openRatesModal}
                                />
                            ))}
                            {OneTimeEarnings.data.length > 0 && (
                                <div className='pt-1'>
                                    <Pagination links={OneTimeEarnings.links} />
                                </div>
                            )}
                            <div className="flex justify-end items-center gap-2 mt-4">
                                <CreateEarningModal />
                                <PrimaryButton onClick={openReportModal}>Generate Report</PrimaryButton>
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
            <DateRangeReportModal
                isOpen={isReportModalOpen}
                onClose={closeReportModal}
                onApply={applyReportRange}
                initialFrom={reportFrom}
                initialTo={reportTo}
                initialProvider={reportProvider}
            />
        </AuthenticatedLayout>
    );
}