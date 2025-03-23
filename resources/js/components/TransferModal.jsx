import Modal from '@/components/Modal';
import PrimaryButton from '@/components/PrimaryButton';
import InputError from '@/components/InputError';
import InputLabel from '@/components/InputLabel';
import TextInput from '@/components/TextInput';
import { useForm } from '@inertiajs/react';
import { Transition } from '@headlessui/react';

export default function TransferModal({ isOpen, onClose, defaultAmount, Route }) {
    const { data, setData, post, processing, errors, reset, recentlySuccessful } = useForm({
        amount: defaultAmount
    });

    const submit = (e) => {
        e.preventDefault();

        post(route(Route), {
            onSuccess: () => {
                reset();
            },
        });
    };

    return (
        <Modal show={isOpen} onClose={onClose}>
            <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-200">Transfer Amount</h2>
                <form onSubmit={submit} className="mt-6 space-y-6">
                    <div className="mt-4">
                        <InputLabel htmlFor="amount" value="Amount" />
                        
                        <TextInput
                            id="amount"
                            value={data.amount}
                            onChange={(e) => setData('amount', e.target.value)}
                            type="number"
                            className="mt-1 block w-full"
                            required={true}
                        />
        
                        <InputError message={errors.amount} className="mt-2" />
                    </div>

                    <div className="flex justify-end items-center gap-4">
                        <PrimaryButton disabled={processing}>Confirm transfer</PrimaryButton>
        
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
            </div>
        </Modal>
    );
}