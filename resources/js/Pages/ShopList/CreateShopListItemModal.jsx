import { useState } from 'react';
import CreateShopListItemForm from './CreateShopListItemForm';
import PrimaryButton from '@/components/PrimaryButton';
import Modal from '@/components/Modal';

export default function CreateShopListItemModal() {
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
                <PrimaryButton onClick={openModal}>Add Shop List Item</PrimaryButton>
            </div>

            <Modal show={isOpen} onClose={closeModal}>
                <div className="p-6">
                    <h3 className="text-lg font-medium leading-6 text-white">Add New Shop List Item</h3>
                    <div className="mt-2">
                        <CreateShopListItemForm />
                    </div>
                    <div className="mt-4 flex justify-end">
                        <PrimaryButton onClick={closeModal}>Close</PrimaryButton>
                    </div>
                </div>
            </Modal>
        </>
    );
}