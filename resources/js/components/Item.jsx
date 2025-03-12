import { useState } from 'react';
import { Inertia } from '@inertiajs/inertia';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import EditItemModal from '@/components/EditItemModal';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import Dropdown from '@/components/Dropdown';
dayjs.extend(relativeTime);

const getCurrencyLabel = (currency) => {
    switch (currency) {
        case '$':
            return 'Dollar';
        case 'bs':
            return 'Bolivares';
        case '$bcv':
            return 'Dollars in bolivares indexed in BCV';
        case '$parallel':
            return 'Dollars in bolivares indexed in parallel tase';
        default:
            return currency;
    }
};

export default function Item({ earning, Route, DestroyRoute }) {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);

    const openEditModal = () => {
        setIsEditModalOpen(true);
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
    };

    const openConfirmDeleteModal = () => {
        setIsConfirmDeleteModalOpen(true);
    };

    const closeConfirmDeleteModal = () => {
        setIsConfirmDeleteModalOpen(false);
    };

    const handleDelete = () => {
        Inertia.delete(route(DestroyRoute, earning.id));
        closeConfirmDeleteModal();
    };

    return (
        <div key={earning.id} className="flex items-center justify-between">
            <div>
                <h3 className="text-lg font-semibold">{earning.description}</h3>
                <p className="text-sm text-gray-500">{earning.amount} {earning.currency ? (getCurrencyLabel(earning.currency)) : '$'}</p>
                {earning.term ? (
                    <p className="text-sm text-gray-500">Claim cycle of {earning.term} days</p>
                ) : earning.OneTimeTase ? (
                    <p className="text-sm text-gray-500">Parallel exchange tase of {earning.OneTimeTase}</p>
                ) : null}
                <p className="text-sm text-gray-500">Saved in {earning.provider}</p>
                <p className="text-sm text-gray-500">{dayjs(earning.created_at).fromNow()}</p>
            </div>
            <Dropdown>
                <Dropdown.Trigger>
                    <button className="text-gray-500 hover:text-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v.01M12 12v.01M12 18v.01" />
                        </svg>
                    </button>
                </Dropdown.Trigger>
                <Dropdown.Content>
                    <button className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-600" onClick={openEditModal}>Edit</button>
                    <button className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-600" onClick={openConfirmDeleteModal}>Delete</button>
                </Dropdown.Content>
            </Dropdown>
            <EditItemModal earning={earning} isOpen={isEditModalOpen} onClose={closeEditModal} Route={Route} />
            <ConfirmDeleteModal isOpen={isConfirmDeleteModalOpen} onClose={closeConfirmDeleteModal} onConfirm={handleDelete} />
        </div>
    );
}