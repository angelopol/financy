

import { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import InputLabel from '@/components/InputLabel';
import InputError from '@/components/InputError';
import PrimaryButton from '@/components/PrimaryButton';
import SelectInput from '@/components/SelectInput';
import TextInput from '@/components/TextInput';


export default function Calculator({ auth, rates }) {
    const [bs, setBs] = useState('');
    const [usd, setUsd] = useState('');
    const [rateType, setRateType] = useState('parallel');
    const [error, setError] = useState('');
    const [lastEdited, setLastEdited] = useState('bs'); // 'bs' o 'usd'

    const getRate = () => {
        if (!rates) return 0;
        return rateType === 'parallel' ? rates.parallel : rates.bcv;
    };

    const handleBsChange = (e) => {
        const value = e.target.value;
        setBs(value);
        setLastEdited('bs');
        setError('');
        const rate = parseFloat(getRate());
        const bsValue = parseFloat(value);
        if (isNaN(rate) || isNaN(bsValue) || rate === 0) {
            setUsd('');
            if (value !== '') setError('Por favor ingresa un monto válido y selecciona una tasa.');
            return;
        }
        setUsd((bsValue / rate).toFixed(2));
    };

    const handleUsdChange = (e) => {
        const value = e.target.value;
        setUsd(value);
        setLastEdited('usd');
        setError('');
        const rate = parseFloat(getRate());
        const usdValue = parseFloat(value);
        if (isNaN(rate) || isNaN(usdValue) || rate === 0) {
            setBs('');
            if (value !== '') setError('Por favor ingresa un monto válido y selecciona una tasa.');
            return;
        }
        setBs((usdValue * rate).toFixed(2));
    };

    const handleRateChange = (e) => {
        const newRateType = e.target.value;
        setRateType(newRateType);
        setError('');
        const rate = parseFloat(newRateType === 'parallel' ? rates.parallel : rates.bcv);
        if (!isNaN(rate) && rate !== 0) {
            if (lastEdited === 'bs' && bs !== '' && !isNaN(parseFloat(bs))) {
                setUsd((parseFloat(bs) / rate).toFixed(2));
            } else if (lastEdited === 'usd' && usd !== '' && !isNaN(parseFloat(usd))) {
                setBs((parseFloat(usd) * rate).toFixed(2));
            }
        }
    };

    return (
        <AuthenticatedLayout user={auth} header={<h2 className="font-semibold text-xl text-gray-800 dark:text-gray-200 leading-tight">Calculator</h2>}>
            <Head title="Calculator" />
            <div className="py-12">
                <div className="max-w-2xl mx-auto sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                            <div className="p-6 text-gray-900 dark:text-gray-100">
                                <h3 className="text-lg font-semibold">Tasa BCV</h3>
                                <p className="text-2xl mt-2">{rates?.bcv ? Number(rates.bcv).toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '--'} Bs</p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                            <div className="p-6 text-gray-900 dark:text-gray-100">
                                <h3 className="text-lg font-semibold">Tasa Paralelo</h3>
                                <p className="text-2xl mt-2">{rates?.parallel ? Number(rates.parallel).toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '--'} Bs</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg p-6">
                        <form className="space-y-6" onSubmit={e => e.preventDefault()}>
                            <div>
                                <InputLabel htmlFor="rateType" value="Tasa" />
                                <SelectInput
                                    id="rateType"
                                    value={rateType}
                                    onChange={handleRateChange}
                                    className="mt-1 block w-full"
                                >
                                    <option value="parallel">Paralelo</option>
                                    <option value="bcv">BCV</option>
                                </SelectInput>
                            </div>
                            <div>
                                <InputLabel htmlFor="bs" value="Bolívares (Bs)" />
                                <TextInput
                                    id="bs"
                                    type="number"
                                    className="mt-1 block w-full"
                                    value={bs}
                                    onChange={handleBsChange}
                                    placeholder="Introduce el monto en bolívares"
                                    min="0"
                                    step="any"
                                />
                            </div>
                            <div>
                                <InputLabel htmlFor="usd" value="Dólares ($)" />
                                <TextInput
                                    id="usd"
                                    type="number"
                                    className="mt-1 block w-full"
                                    value={usd}
                                    onChange={handleUsdChange}
                                    placeholder="Introduce el monto en dólares"
                                    min="0"
                                    step="any"
                                />
                            </div>
                            <InputError message={error} className="mt-2" />
                        </form>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}