import Modal from '@/components/Modal';
import PrimaryButton from '@/components/PrimaryButton';
import InputError from '@/components/InputError';
import InputLabel from '@/components/InputLabel';
import SelectInput from '@/components/SelectInput';
import { useForm } from '@inertiajs/react';
import TextInput from '@/components/TextInput';
import Checkbox from '@/components/Checkbox';

export default function PurchasedModal({ isOpen, onClose, item }) {
    const { data, setData, post, processing, errors } = useForm({
        provider: 'auto',
        amount: item.amount,
        not_discount: false,
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('shoplist.purchased', item.id), {
            onSuccess: () => onClose(),
        });
    };

    return (
        <Modal show={isOpen} onClose={onClose}>
            <form onSubmit={submit} className="p-6">
                <h3 className="text-lg font-medium leading-6 text-white">Mark as Purchased</h3>
                <div className="mt-4">
                    <div>
                        <InputLabel htmlFor="provider" value="Provider" />
                        <SelectInput
                            id="provider"
                            value={data.provider}
                            onChange={(e) => setData('provider', e.target.value)}
                            className="mt-1 block w-full"
                            required
                        >
                            <option value="auto">Automatic / use both</option>
                            <option value="box">Box first</option>
                            <option value="savings">Savings first</option>
                        </SelectInput>
                        <InputError message={errors.provider} className="mt-2" />
                    </div>
                    <div className="mt-4">
                        <InputLabel htmlFor="amount" value="Amount" />
                        <TextInput
                            id="amount"
                            type="number"
                            min="0"
                            value={data.amount}
                            onChange={e => setData('amount', e.target.value)}
                            className="mt-1 block w-full"
                            required
                        />
                        <InputError message={errors.amount} className="mt-2" />
                    </div>
                    <label className="mt-4 flex items-center gap-2 text-sm text-gray-300"><Checkbox checked={data.not_discount} onChange={(e) => setData('not_discount', e.target.checked)} />Not discount (already registered)</label>
                    <p className="mt-1 text-xs text-gray-500">When enabled, no balance is reduced and no expense history is created.</p>
                </div>
                <div className="mt-4 flex justify-end">
                    <PrimaryButton type="button" onClick={onClose} className="mr-2">Cancel</PrimaryButton>
                    <PrimaryButton type="submit" disabled={processing}>Submit</PrimaryButton>
                </div>
            </form>
        </Modal>
    );
}
