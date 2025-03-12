import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CreateExpensesModal from './CreateExpensesModal';

export default function Expenses({ auth }) {
    return (
        <AuthenticatedLayout
            user={auth}
            header={<h2 className="font-semibold text-xl text-gray-800 dark:text-gray-200 leading-tight">Expenses</h2>}
        >
            <Head title="Expenses" />

            <div className="py-12">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                        <div className="p-6">
                            <CreateExpensesModal />
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}