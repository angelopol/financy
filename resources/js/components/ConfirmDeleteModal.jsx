import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';

export default function ConfirmDeleteModal({ isOpen, onClose, onConfirm }) {
    return (
        <Modal show={isOpen} onClose={onClose}>
            <div className="p-6">
                <h3 className="text-lg font-medium leading-6 text-white">Confirm Deletion</h3>
                <p className="mt-2 text-sm text-gray-500">Are you sure you want to delete this earning? This action cannot be undone.</p>
                <div className="mt-4 flex justify-end space-x-2">
                    <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
                    <PrimaryButton onClick={onConfirm}>Delete</PrimaryButton>
                </div>
            </div>
        </Modal>
    );
}