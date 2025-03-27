import { useState } from 'react';
import { Inertia } from '@inertiajs/inertia';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import EditItemModal from '@/components/EditItemModal';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import PurchasedModal from '@/components/PurchasedModal';
import Dropdown from '@/components/Dropdown';
dayjs.extend(relativeTime);

const getCurrencyLabel = (currency) => {
    switch (currency) {
        case '$':
            return '$';
        case 'bs':
            return 'Bs.';
        case '$bcv':
            return 'Dollars in bolivares indexed in BCV';
        case '$parallel':
            return 'Dollars in bolivares indexed in parallel tase';
        default:
            return currency;
    }
};

export default function Item({ item, Route, DestroyRoute, openRatesModal }) {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
    const [isPurchasedModalOpen, setIsPurchasedModalOpen] = useState(false);

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

    const openPurchasedModal = () => {
        setIsPurchasedModalOpen(true);
    };

    const closePurchasedModal = () => {
        setIsPurchasedModalOpen(false);
    };

    const handleDelete = () => {
        Inertia.delete(route(DestroyRoute, item.id));
        closeConfirmDeleteModal();
    };

    const handlePending = () => {
        Inertia.post(route('shoplist.pending', item.id));
    };

    const handleClaim = (item) => {
        if ('OneTimeTase' in item) {
            Inertia.post(route('earnings.claim', item.id));
        } else {
            Inertia.post(route('expenses.claim', item.id));
        }
    };

    return (
        <div key={item.id} className="flex items-center justify-between">
            <div>
                <h3 className="text-lg font-semibold">{item.description}</h3>
                <p className="text-sm text-gray-500" onClick={() => openRatesModal(item.amount, item.currency ? item.currency : '$')}>{item.amount} {item.currency ? (getCurrencyLabel(item.currency)) : '$'}</p>
                {item.term ? (
                    <p className="text-sm text-gray-500">Claim cycle of {item.term} days</p>
                ) : item.OneTimeTase ? (
                    <p className="text-sm text-gray-500">Parallel exchange tase of {item.OneTimeTase}</p>
                ) : null}
                <p className="text-sm text-gray-500">Saved in {item.provider}</p>
                <p className="text-sm text-gray-500">{dayjs(item.created_at).fromNow()}</p>
                {item.status ? (
                    <p className={`text-sm ${item.status === 'pending' ? 'text-yellow-500' : item.status === 'purchased' ? 'text-green-500' : 'text-gray-500'}`}>{item.status}</p>
                ) : null}
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
                    {item.status && item.status === "pending" && (
                        <button className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-600" onClick={openPurchasedModal}>Purchased</button>
                    )}
                    {item.status && item.status === "purchased" && (
                        <button className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-600" onClick={handlePending}>Pending</button>
                    )}
                    {item.UpdatedTerm && (
                        <button
                            className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-600"
                            onClick={() => handleClaim(item)}
                        >
                            Claim
                        </button>
                    )}
                </Dropdown.Content>
            </Dropdown>
            <EditItemModal item={item} isOpen={isEditModalOpen} onClose={closeEditModal} Route={Route} amount={item.status ? true : null} />
            <ConfirmDeleteModal isOpen={isConfirmDeleteModalOpen} onClose={closeConfirmDeleteModal} onConfirm={handleDelete} />
            <PurchasedModal item={item} isOpen={isPurchasedModalOpen} onClose={closePurchasedModal} />
        </div>
    );
}