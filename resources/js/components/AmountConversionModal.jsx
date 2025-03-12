import Modal from '@/Components/Modal';
import SecondaryButton from '@/Components/SecondaryButton';
import { GetDollarRates, ConvertAmount } from '@/helpers/convertions';

export default function AmountConversionModal({ isOpen, onClose, amount, currency, rates }) {
    const convertedAmount = ConvertAmount(amount, currency, rates);
    const conversions = GetDollarRates(convertedAmount, rates);

    return (
        <Modal show={isOpen} onClose={onClose}>
            <div className="p-6">
                <h3 className="text-lg font-medium leading-6 text-white">Amount Conversions Rates</h3>
                <div className="mt-4">
                    <p className="text-sm text-gray-500">Amount in $: {convertedAmount}</p>
                    <p className="text-sm text-gray-500">Amount in Bs (BCV): {conversions.bcv}</p>
                    <p className="text-sm text-gray-500">Amount in Bs (Parallel): {conversions.parallel}</p>
                </div>
                <div className="mt-4 flex justify-end">
                    <SecondaryButton onClick={onClose}>Close</SecondaryButton>
                </div>
            </div>
        </Modal>
    );
}