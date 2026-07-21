import Modal from '@/components/Modal';
import InputLabel from '@/components/InputLabel';
import TextInput from '@/components/TextInput';
import InputError from '@/components/InputError';
import PrimaryButton from '@/components/PrimaryButton';
import SelectInput from '@/components/SelectInput';
import { useForm } from '@inertiajs/react';
import TagInput from '@/components/TagInput';

export default function EditItemModal({ item, isOpen, onClose, Route, amount = null, parallelTase = null, projectId = null }) {
    let values = {
        description: item.description,
        slug: item.slug ? item.slug.split(' ') : [],
        project_id: projectId,
    };
    if (amount) {
        values = {
            ...values,
            amount: item.amount,
            currency: item.currency || "$",
        };
    }
    const { data, setData, patch, processing, errors } = useForm(values);

    const submit = (e) => {
        e.preventDefault();
        patch(route(Route, item.id), {
            onSuccess: () => onClose(),
        });
    };

    return (
        <Modal show={isOpen} onClose={onClose}>
            <form onSubmit={submit} className="p-6 space-y-6">
                <h3 className="text-lg font-medium leading-6 text-white">Edit Item</h3>
                <div>
                    <InputLabel htmlFor="description" value="Description" />
                    <TextInput
                        id="description"
                        value={data.description}
                        onChange={(e) => setData('description', e.target.value)}
                        type="text"
                        className="mt-1 block w-full"
                        maxLength="500"
                    />
                    <InputError message={errors.description} className="mt-2" />
                </div>
                {'slug' in item && <div><InputLabel htmlFor="edit-slug" value="Keywords" /><TagInput id={`edit-slug-${item.id}`} value={data.slug} onChange={(tags) => setData('slug', tags)} /><InputError message={errors.slug} className="mt-2" /></div>}
                {amount && (
                    <>
                        <div>
                            <InputLabel htmlFor="amount" value="Amount" />
                            <TextInput
                                id="amount"
                                value={data.amount}
                                onChange={(e) => setData('amount', e.target.value)}
                                type="number"
                                className="mt-1 block w-full"
                            />
                            <InputError message={errors.amount} className="mt-2" />
                        </div>
                        <div>
                            <InputLabel htmlFor="currency" value="Currency" />
                            <SelectInput
                                id="currency"
                                value={data.currency}
                                onChange={(e) => setData('currency', e.target.value)}
                                className="mt-1 block w-full"
                            >
                                <option value="$">Dollar</option>
                                <option value="bs">Bolivares</option>
                                <option value="$bcv">Dollars in bolivares indexed in BCV</option>
                                <option value="€">Euro</option>
                                {parallelTase && (
                                    <option value="$parallel">Dollars in bolivares indexed in parallel tase</option>
                                )}
                            </SelectInput>
                            <InputError message={errors.currency} className="mt-2" />
                        </div>
                    </>
                )}
                <div className="mt-4 flex justify-end">
                    <PrimaryButton disabled={processing}>Save</PrimaryButton>
                    <PrimaryButton onClick={onClose} className="ml-2" type="button">Close</PrimaryButton>
                </div>
            </form>
        </Modal>
    );
}
