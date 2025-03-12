import { useState } from 'react';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import { useForm } from '@inertiajs/react';

export default function EditItemModal({ earning, isOpen, onClose, Route }) {
    const { data, setData, patch, processing, errors } = useForm({
        description: earning.description,
    });

    const submit = (e) => {
        e.preventDefault();
        patch(route(Route, earning.id), {
            onSuccess: () => onClose(),
        });
    };

    return (
        <Modal show={isOpen} onClose={onClose}>
            <form onSubmit={submit} className="p-6">
                <h3 className="text-lg font-medium leading-6 text-white">Edit Description</h3>
                <div className="mt-2">
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
                <div className="mt-4 flex justify-end">
                    <PrimaryButton disabled={processing}>Save</PrimaryButton>
                    <PrimaryButton onClick={onClose} className="ml-2">Close</PrimaryButton>
                </div>
            </form>
        </Modal>
    );
}