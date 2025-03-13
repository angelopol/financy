import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import SelectInput from '@/Components/SelectInput';
import { useForm } from '@inertiajs/react';

export default function PurchasedModal({ isOpen, onClose, item }) {
    const { data, setData, post, processing, errors } = useForm({
        provider: 'box',
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
                            <option value="box">Box</option>
                            <option value="savings">Savings</option>
                        </SelectInput>
        
                        <InputError message={errors.provider} className="mt-2" />
                    </div>
                </div>
                <div className="mt-4 flex justify-end">
                    <PrimaryButton onClick={onClose} className="mr-2">Cancel</PrimaryButton>
                    <PrimaryButton type="submit" disabled={processing}>Submit</PrimaryButton>
                </div>
            </form>
        </Modal>
    );
}