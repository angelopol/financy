import { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import InputLabel from '@/components/InputLabel';
import SelectInput from '@/components/SelectInput';
import TextInput from '@/components/TextInput';

export default function Calculator({ auth, rates }) {
    const [values, setValues] = useState({ bs: '', usd: '', eur: '' });
    const [rateType, setRateType] = useState('parallel');
    const [lastEdited, setLastEdited] = useState('bs');
    const average = (a, b) => (Number(a) + Number(b)) / 2;
    const selectedRates = (type = rateType) => ({
        usd: type === 'bcv' ? Number(rates.bcv) : type === 'average' ? average(rates.bcv, rates.parallel) : Number(rates.parallel),
        eur: type === 'bcv' ? Number(rates.euro) : type === 'average' ? average(rates.euro, rates.euro_parallel) : Number(rates.euro_parallel),
    });
    const convert = (source, raw, type = rateType) => {
        if (raw === '' || Number.isNaN(Number(raw))) return { bs: source === 'bs' ? raw : '', usd: source === 'usd' ? raw : '', eur: source === 'eur' ? raw : '' };
        const currentRates = selectedRates(type);
        const bs = source === 'bs' ? Number(raw) : source === 'usd' ? Number(raw) * currentRates.usd : Number(raw) * currentRates.eur;
        return { bs: bs.toFixed(2), usd: (bs / currentRates.usd).toFixed(2), eur: (bs / currentRates.eur).toFixed(2), [source]: raw };
    };
    const changed = (source, value) => { setLastEdited(source); setValues(convert(source, value)); };
    const rateChanged = (type) => { setRateType(type); setValues(convert(lastEdited, values[lastEdited], type)); };
    const display = (value) => Number(value || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <AuthenticatedLayout user={auth} header={<h2 className="font-semibold text-xl text-gray-800 dark:text-gray-200">Currency calculator</h2>}>
            <Head title="Calculator" />
            <div className="py-12"><div className="max-w-4xl mx-auto sm:px-6 lg:px-8 space-y-6">
                <div className="bg-white dark:bg-gray-800 shadow-sm sm:rounded-lg p-6">
                    <div className="space-y-5">
                        <div><InputLabel htmlFor="rateType" value="Rate" /><SelectInput id="rateType" value={rateType} onChange={(e) => rateChanged(e.target.value)} className="mt-1 block w-full"><option value="parallel">Parallel</option><option value="bcv">Official / BCV</option><option value="average">Average</option></SelectInput></div>
                        {[['bs', 'Bolívares (Bs)'], ['usd', 'Dollars ($)'], ['eur', 'Euros (€)']].map(([key, label]) => <div key={key}><InputLabel htmlFor={key} value={label} /><TextInput id={key} type="number" min="0" step="any" value={values[key]} onChange={(e) => changed(key, e.target.value)} className="mt-1 block w-full" /></div>)}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[['Dollar BCV', rates.bcv], ['Dollar parallel', rates.parallel], ['Euro BCV', rates.euro], ['Euro parallel', rates.euro_parallel]].map(([label, value]) => <div key={label} className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-5 text-gray-900 dark:text-gray-100"><h3 className="font-semibold">{label}</h3><p className="text-xl mt-2">{display(value)} Bs</p></div>)}
                </div>
            </div></div>
        </AuthenticatedLayout>
    );
}
