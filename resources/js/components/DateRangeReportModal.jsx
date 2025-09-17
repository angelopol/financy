import { useState, useEffect } from 'react';
import Modal from '@/components/Modal';
import PrimaryButton from '@/components/PrimaryButton';
import SecondaryButton from '@/components/SecondaryButton';
import InputLabel from '@/components/InputLabel';
import TextInput from '@/components/TextInput';
import InputError from '@/components/InputError';
import SelectInput from '@/components/SelectInput';

export default function DateRangeReportModal({ isOpen, onClose, onApply, initialFrom = '', initialTo = '', initialProvider = 'both' }) {
    const [from, setFrom] = useState(initialFrom);
    const [to, setTo] = useState(initialTo);
    const [provider, setProvider] = useState(initialProvider);
    const [error, setError] = useState('');

    useEffect(() => {
        setFrom(initialFrom);
        setTo(initialTo);
        setProvider(initialProvider || 'both');
        setError('');
    }, [isOpen, initialFrom, initialTo, initialProvider]);

    const validate = (f, t) => {
        if (f && t && f > t) {
            return 'La fecha "desde" no puede ser mayor que la fecha "hasta".';
        }
        return '';
    };

    const handleApply = () => {
        const err = validate(from, to);
        if (err) {
            setError(err);
            return;
        }
        onApply({ from, to, provider });
    };

    return (
        <Modal show={isOpen} onClose={onClose}>
            <div className="p-6">
                <h3 className="text-lg font-medium leading-6 text-white">Rango de fechas del reporte</h3>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <InputLabel htmlFor="from" value="Desde" />
                        <TextInput
                            id="from"
                            type="date"
                            className="mt-1 block w-full"
                            value={from}
                            onChange={(e) => { setFrom(e.target.value); setError(validate(e.target.value, to)); }}
                        />
                    </div>

                    <div>
                        <InputLabel htmlFor="to" value="Hasta" />
                        <TextInput
                            id="to"
                            type="date"
                            className="mt-1 block w-full"
                            value={to}
                            onChange={(e) => { setTo(e.target.value); setError(validate(from, e.target.value)); }}
                        />
                    </div>

                    <div>
                        <InputLabel htmlFor="provider" value="Provider" />
                        <SelectInput
                            id="provider"
                            className="mt-1 block w-full"
                            value={provider}
                            onChange={(e) => setProvider(e.target.value)}
                        >
                            <option value="both">Both</option>
                            <option value="savings">Savings</option>
                            <option value="box">Box</option>
                        </SelectInput>
                    </div>
                </div>

                {error && <InputError className="mt-2" message={error} />}

                <div className="mt-6 flex justify-end gap-3">
                    <SecondaryButton type="button" onClick={onClose}>Cancelar</SecondaryButton>
                    <PrimaryButton type="button" onClick={handleApply} disabled={!!error}>Aplicar</PrimaryButton>
                </div>
            </div>
        </Modal>
    );
}
