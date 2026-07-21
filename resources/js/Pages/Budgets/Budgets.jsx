import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, useForm } from '@inertiajs/react';
import InputLabel from '@/components/InputLabel';
import InputError from '@/components/InputError';
import TextInput from '@/components/TextInput';
import PrimaryButton from '@/components/PrimaryButton';
import DangerButton from '@/components/DangerButton';
import TagInput from '@/components/TagInput';

function CategoryRow({ category, suggestions }) {
    const { data, setData, patch, processing, errors } = useForm({ name: category.name, amount: category.amount, slug: category.slug.split(' ') });
    return <form onSubmit={(e) => { e.preventDefault(); patch(route('budgets.categories.update', category.id)); }} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <div className="grid gap-3 md:grid-cols-2"><div><InputLabel value="Category" /><TextInput value={data.name} onChange={(e) => setData('name', e.target.value)} className="mt-1 w-full" /></div><div><InputLabel value="Budget (USD)" /><TextInput type="number" min="0" step="0.01" value={data.amount} onChange={(e) => setData('amount', e.target.value)} className="mt-1 w-full" /></div></div>
        <div className="mt-3"><InputLabel value="Expense keywords" /><TagInput id={`budget-tags-${category.id}`} value={data.slug} suggestions={suggestions} onChange={(tags) => setData('slug', tags)} /><InputError message={errors.slug} /></div>
        <div className="mt-4"><div className="mb-1 flex justify-between text-sm"><span>Spent {Number(category.spent).toFixed(2)}$</span><span>Remaining {Number(category.remaining).toFixed(2)}$</span></div><div className="h-3 rounded-full bg-gray-200"><div className={`h-3 rounded-full ${category.spent > category.amount ? 'bg-red-500' : 'bg-indigo-500'}`} style={{width: `${Math.min(100, category.amount > 0 ? category.spent / category.amount * 100 : 0)}%`}} /></div></div>
        <div className="mt-4 flex justify-end gap-2"><DangerButton type="button" onClick={() => router.delete(route('budgets.categories.destroy', category.id))}>Delete</DangerButton><PrimaryButton disabled={processing}>Update</PrimaryButton></div>
    </form>;
}

export default function Budgets({ auth, month, categories, availableSlugs }) {
    const { data, setData, post, processing, errors, reset } = useForm({ month, name: '', amount: '', slug: [] });
    const submit = (e) => { e.preventDefault(); post(route('budgets.categories.store'), { onSuccess: () => reset('name', 'amount', 'slug') }); };
    return <AuthenticatedLayout user={auth} header={<h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Monthly budgets</h2>}><Head title="Budgets" /><div className="py-12"><div className="mx-auto max-w-5xl space-y-6 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800 text-gray-900 dark:text-gray-100"><InputLabel htmlFor="budget-month" value="Month" /><TextInput id="budget-month" type="month" value={month} onChange={(e) => router.get(route('budgets.index'), {month: e.target.value})} className="mt-1" /></div>
        <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800 text-gray-900 dark:text-gray-100">{categories.length ? categories.map((category) => <CategoryRow key={category.id} category={category} suggestions={availableSlugs} />) : <p className="text-gray-500">No categories for this month yet.</p>}</div>
        <form onSubmit={submit} className="space-y-4 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-800 text-gray-900 dark:text-gray-100"><h3 className="font-semibold">Add category</h3><div className="grid gap-4 md:grid-cols-2"><div><InputLabel value="Category" /><TextInput value={data.name} onChange={(e) => setData('name', e.target.value)} className="mt-1 w-full" /><InputError message={errors.name} /></div><div><InputLabel value="Budget (USD)" /><TextInput type="number" min="0" step="0.01" value={data.amount} onChange={(e) => setData('amount', e.target.value)} className="mt-1 w-full" /><InputError message={errors.amount} /></div></div><div><InputLabel value="Expense keywords" /><TagInput id="new-budget-tags" value={data.slug} suggestions={availableSlugs} onChange={(tags) => setData('slug', tags)} /><InputError message={errors.slug} /></div><div className="flex justify-end"><PrimaryButton disabled={processing}>Add category</PrimaryButton></div></form>
    </div></div></AuthenticatedLayout>;
}
