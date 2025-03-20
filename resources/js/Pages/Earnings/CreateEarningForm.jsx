import InputError from '@/components/InputError';
import InputLabel from '@/components/InputLabel';
import PrimaryButton from '@/components/PrimaryButton';
import TextInput from '@/components/TextInput';
import SelectInput from '@/components/SelectInput';
import { useForm } from '@inertiajs/react';
import { Transition } from '@headlessui/react';

export default function CreateEarningForm() {
    const { data, setData, post, processing, errors, reset, recentlySuccessful } = useForm({
        description: '',
        amount: '',
        currency: '$',
        provider: 'box',
        term: '',
        nextterm: '',
    });

    const submit = (e) => {
        e.preventDefault();

        post(route('earnings.store'), {
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
                    <option value="$parallel">Dollars in bolivares indexed in parallel tase</option>
                </SelectInput>

                <InputError message={errors.currency} className="mt-2" />
            </div>

            <div>
                <InputLabel htmlFor="provider" value="Provider" />

                <SelectInput
                    id="provider"
                    value={data.provider}
                    onChange={(e) => setData('provider', e.target.value)}
                    className="mt-1 block w-full"
                >
                    <option value="box">Box</option>
                    <option value="savings">Savings</option>
                </SelectInput>

                <InputError message={errors.provider} className="mt-2" />
            </div>

            <div>
                <InputLabel htmlFor="term" value="Claim term in days" />

                <TextInput
                    id="term"
                    value={data.term}
                    onChange={(e) => setData('term', e.target.value)}
                    type="number"
                    className="mt-1 block w-full"
                    min="1"
                />

                <InputError message={errors.term} className="mt-2" />
            </div>

            <div>
                <InputLabel htmlFor="nextterm" value="Days to the next claim" />

                <TextInput
                    id="nextterm"
                    value={data.nextterm}
                    onChange={(e) => setData('nextterm', e.target.value)}
                    type="number"
                    className="mt-1 block w-full"
                />

                <InputError message={errors.nextterm} className="mt-2" />
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