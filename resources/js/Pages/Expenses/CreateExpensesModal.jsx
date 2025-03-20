import { useState } from 'react';
import CreateExpensesForm from './CreateExpensesForm';
import PrimaryButton from '@/components/PrimaryButton';
import Modal from '@/components/Modal';

export default function CreateExpensesModal() {
    const [isOpen, setIsOpen] = useState(false);

    function closeModal() {
        setIsOpen(false);
    }

    function openModal() {
        setIsOpen(true);
    }

    return (
        <>
            <div className="flex justify-end">
                <PrimaryButton onClick={openModal}>Add Expense</PrimaryButton>
            </div>

            <Modal show={isOpen} onClose={closeModal}>
                <div className="p-6">
                    <h3 className="text-lg font-medium leading-6 text-white">Add New Expense</h3>
                    <div className="mt-2">
                        <CreateExpensesForm />
                    </div>
                    <div className="mt-4 flex justify-end">
                        <PrimaryButton onClick={closeModal}>Close</PrimaryButton>
                    </div>
                </div>
            </Modal>
        </>
    );
}