import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import PrimaryButton from '@/components/PrimaryButton';
import dayjs from 'dayjs';
import { useRef } from 'react';

const currencyLabel = (c) => {
    switch (c) {
        case '$':
            return 'Dollar';
        case 'bs':
            return 'Bolivares';
        case '$bcv':
            return 'Dollars in bolivares indexed in BCV';
        case '$parallel':
            return 'Dollars in bolivares indexed in parallel tase';
        default:
            return c;
    }
};

const providerLabel = (p) => {
    switch ((p || '').toLowerCase()) {
        case 'savings':
            return 'Savings';
        case 'box':
            return 'Box';
        default:
            return p;
    }
};

export default function EarningsReport({ auth, items, from, to, provider }) {
    const printRef = useRef(null);
    const handlePrint = () => {
        const printContents = printRef.current ? printRef.current.innerHTML : '';
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.open();
        w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Earnings Report</title>
            <style>
                body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; padding: 24px; }
                h1 { font-size: 20px; margin-bottom: 12px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
                thead { background: #f9fafb; }
            </style>
        </head><body>${printContents}</body></html>`);
        w.document.close();
        w.focus();
        w.print();
        w.close();
    };
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    if (provider && provider !== 'both') query.set('provider', provider);
    const csvHref = route('reports.earnings.csv') + (query.toString() ? `?${query.toString()}` : '');

    return (
        <AuthenticatedLayout user={auth} header={<h2 className="font-semibold text-xl text-gray-800 dark:text-gray-200 leading-tight">Earnings Report</h2>}>
            <Head title="Earnings Report" />
            <div className="py-12">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                        <div className="p-6 text-gray-900 dark:text-gray-100">
                            <div className="flex justify-end gap-3 mb-4 print:hidden">
                                <a href={csvHref}>
                                    <PrimaryButton>Download CSV</PrimaryButton>
                                </a>
                                <PrimaryButton onClick={handlePrint}>Download PDF</PrimaryButton>
                            </div>
                            <div ref={printRef}>
                                {(from || to || provider) && (
                                    <p className="mb-3 text-sm text-gray-400">Rango: {from || 'inicio'} → {to || 'hoy'} {provider ? `| Provider: ${providerLabel(provider)}` : ''}</p>
                                )}
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-700">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {items.data.map((row) => (
                                            <tr key={row.id}>
                                                <td className="px-4 py-2 whitespace-nowrap">{row.id}</td>
                                                <td className="px-4 py-2 whitespace-nowrap">{row.description}</td>
                                                <td className="px-4 py-2 whitespace-nowrap">{Number(row.amount).toFixed(2)}</td>
                                                <td className="px-4 py-2 whitespace-nowrap">{currencyLabel(row.currency)}</td>
                                                <td className="px-4 py-2 whitespace-nowrap">{providerLabel(row.provider)}</td>
                                                <td className="px-4 py-2 whitespace-nowrap">{row.created_at ? dayjs(row.created_at).format('DD/MM/YYYY HH:mm') : ''}</td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
