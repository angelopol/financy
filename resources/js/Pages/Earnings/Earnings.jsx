import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CreateEarningModal from './CreateEarningModal';
import Item from '@/components/Item';

export default function Earnings({ auth, OneTimeEarnings, RecurringEarnings }) {
    return (
        <AuthenticatedLayout
            user={auth}
            header={<h2 className="font-semibold text-xl text-gray-800 dark:text-gray-200 leading-tight">Earnings</h2>}
        >
            <Head title="Earnings" />

            <div className="py-12">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow-sm sm:rounded-lg">
                        <div className="p-6">
                            {RecurringEarnings.map((earning) => (
                                <Item
                                    key={earning.id}
                                    earning={earning}
                                    Route='earnings.update'
                                    DestroyRoute='earnings.destroy'
                                />
                            ))}
                            {RecurringEarnings.length > 0 && <br />}
                            {OneTimeEarnings.map((earning) => (
                                <Item
                                    key={earning.id}
                                    earning={earning}
                                    Route='earnings.update'
                                    DestroyRoute='earnings.destroy'
                                />
                            ))}
                            <CreateEarningModal />
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}