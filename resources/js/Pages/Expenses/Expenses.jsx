import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CreateExpensesModal from './CreateExpensesModal';
import Item from '@/components/Item';
import Pagination from '@/components/Pagination';
import { useState } from 'react';
import { router } from '@inertiajs/react';
import AmountConversionModal from '@/components/AmountConversionModal';
import PrimaryButton from '@/components/PrimaryButton';
import DateRangeReportModal from '@/components/DateRangeReportModal';

export default function Expenses({ auth, RecurringExpenses, OneTimeExpenses, rates, projectId = null, filters = {}, recurringTotals = {} }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAmount, setSelectedAmount] = useState(0);
    const [selectedCurrency, setSelectedCurrency] = useState('$');
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportFrom, setReportFrom] = useState('');
    const [reportTo, setReportTo] = useState('');
    const [reportProvider, setReportProvider] = useState('both');
    const [search, setSearch] = useState(filters.q || '');

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
    const applyReportRange = ({ from, to, provider, keywords }) => {
        setReportFrom(from);
        setReportTo(to);
        setReportProvider(provider || 'both');
        setIsReportModalOpen(false);
        const params = new URLSearchParams();
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        if (provider && provider !== 'both') params.set('provider', provider);
        if (keywords) params.set('q', keywords);
        if (projectId) params.set('project_id', projectId);
        window.location.href = route('reports.expenses') + (params.toString() ? `?${params.toString()}` : '');
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
            projectId={projectId}
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
                            <form onSubmit={(e) => { e.preventDefault(); router.get(route('expenses.index'), { q: search, project_id: projectId || undefined }, { preserveState: true }); }} className="mb-5 flex gap-2">
                                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search description or keywords" className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
                                <PrimaryButton>Search</PrimaryButton>
                            </form>
                            {items}
                            {RecurringExpenses.data.length > 0 && (
                                <>
                                    <div className="p-1">
                                        <Pagination links={RecurringExpenses.links} />
                                    </div>
                                    <div className="flex flex-col items-end text-sm text-gray-500"><span onClick={() => openRatesModal(recurringTotals.every15Days || 0, '$')}>Every 15 days: {Number(recurringTotals.every15Days || 0).toFixed(2)}$</span><span onClick={() => openRatesModal(recurringTotals.monthly || 0, '$')}>Monthly total: {Number(recurringTotals.monthly || 0).toFixed(2)}$</span></div>
                                </>
                            )}
                            {OneTimeExpenses.data.map((expense) => (
                                <Item
                                    key={expense.id}
                                    item={expense}
                                    Route='expenses.update'
                                    DestroyRoute='expenses.destroy'
                                    openRatesModal={openRatesModal}
                                    projectId={projectId}
                                />
                            ))}
                            {OneTimeExpenses.data.length > 0 && (
                                <div className='pt-1'>
                                    <Pagination links={OneTimeExpenses.links} />
                                </div>
                            )}
                            <div className="flex justify-end items-center gap-2 mt-4">
                                <CreateExpensesModal projectId={projectId} />
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
                initialKeywords={search}
            />
        </AuthenticatedLayout>
    );
}
