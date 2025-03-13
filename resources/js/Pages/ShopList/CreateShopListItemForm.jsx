import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import SelectInput from '@/Components/SelectInput';
import { useForm } from '@inertiajs/react';
import { Transition } from '@headlessui/react';

export default function CreateShopListItemForm() {
    const { data, setData, post, processing, errors, reset, recentlySuccessful } = useForm({
        description: '',
        amount: '',
        currency: '$'
    });

    const submit = (e) => {
        e.preventDefault();

        post(route('shoplist.store'), {
            onSuccess: () => {
                reset();
            },
        });
    };

    return (
        <form onSubmit={submit} className="mt-6 space-y-6">
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
                </SelectInput>

                <InputError message={errors.currency} className="mt-2" />
            </div>

            <div className="flex justify-end items-center gap-4">
                <PrimaryButton disabled={processing}>Save</PrimaryButton>

                <Transition
                    show={recentlySuccessful}
                    enter="transition ease-in-out"
                    enterFrom="opacity-0"
                    leave="transition ease-in-out"
                    leaveTo="opacity-0"
                >
                    <p className="text-sm text-gray-600 dark:text-gray-400">Saved.</p>
                </Transition>
            </div>
        </form>
    );
}