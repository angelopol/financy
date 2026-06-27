import InputError from '@/components/InputError';
import InputLabel from '@/components/InputLabel';
import PrimaryButton from '@/components/PrimaryButton';
import TextInput from '@/components/TextInput';
import SelectInput from '@/components/SelectInput';
import { router, useForm } from '@inertiajs/react';
import { Transition } from '@headlessui/react';

export default function CreateExpensesForm({ projectId = null }) {
    const { data, setData, processing, errors, reset, recentlySuccessful } = useForm({
        description: '',
        amount: '',
        provider: 'box',
        term: '',
        nextterm: '',
        currency: '$',
        project_id: projectId,
        split_mode: 'none',
        split_user_ids: '',
        splits_json: '',
    });

    const submit = (e) => {
        e.preventDefault();

        let splits = [];
        if (data.splits_json) {
            try {
                splits = JSON.parse(data.splits_json);
            } catch (_error) {
                splits = [];
            }
        }

        const payload = {
            ...data,
            split_user_ids: data.split_user_ids
                ? data.split_user_ids.split(',').map((id) => Number(id.trim())).filter(Boolean)
                : [],
            splits,
        };

        router.post(route('expenses.store'), payload, {
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
                <InputLabel htmlFor="split_mode" value="Split payment" />

                <SelectInput
                    id="split_mode"
                    value={data.split_mode}
                    onChange={(e) => setData('split_mode', e.target.value)}
                    className="mt-1 block w-full"
                >
                    <option value="none">No split</option>
                    <option value="equal">Equal split</option>
                    <option value="fixed">Fixed amounts</option>
                </SelectInput>

                <InputError message={errors.split_mode} className="mt-2" />
            </div>

            {data.split_mode === 'equal' && (
                <div>
                    <InputLabel htmlFor="split_user_ids" value="User IDs separated by commas" />

                    <TextInput
                        id="split_user_ids"
                        value={data.split_user_ids}
                        onChange={(e) => setData('split_user_ids', e.target.value)}
                        type="text"
                        className="mt-1 block w-full"
                    />

                    <InputError message={errors.split_user_ids} className="mt-2" />
                </div>
            )}

            {data.split_mode === 'fixed' && (
                <div>
                    <InputLabel htmlFor="splits_json" value="Fixed splits JSON" />

                    <textarea
                        id="splits_json"
                        value={data.splits_json}
                        onChange={(e) => setData('splits_json', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 bg-gray-900 text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        placeholder='[{"user_id":1,"amount":10.50}]'
                    />

                    <InputError message={errors.splits} className="mt-2" />
                </div>
            )}

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
