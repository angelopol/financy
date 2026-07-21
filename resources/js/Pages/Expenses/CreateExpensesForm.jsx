import InputError from '@/components/InputError';
import InputLabel from '@/components/InputLabel';
import PrimaryButton from '@/components/PrimaryButton';
import TextInput from '@/components/TextInput';
import SelectInput from '@/components/SelectInput';
import Checkbox from '@/components/Checkbox';
import TagInput from '@/components/TagInput';
import { descriptionTags } from '@/helpers/slugs';
import { useForm } from '@inertiajs/react';
import { useState } from 'react';

export default function CreateExpensesForm({ projectId = null }) {
    const [slugTouched, setSlugTouched] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        description: '', slug: [], amount: '', currency: '$', provider: 'auto',
        recurrence_type: 'one_time', term: '', claim_day: '', nextterm: '', auto_claim: true, project_id: projectId,
    });
    const descriptionChanged = (value) => setData((current) => ({...current, description: value, slug: slugTouched ? current.slug : descriptionTags(value)}));
    const submit = (event) => {
        event.preventDefault();
        post(route('expenses.store'), { onSuccess: () => { reset(); setSlugTouched(false); } });
    };

    return (
        <form onSubmit={submit} className="mt-6 space-y-6">
            <div><InputLabel htmlFor="description" value="Description" /><TextInput id="description" value={data.description} onChange={(e) => descriptionChanged(e.target.value)} className="mt-1 block w-full" maxLength="500" /><InputError message={errors.description} className="mt-2" /></div>
            <div><InputLabel htmlFor="expense-slug" value="Keywords" /><TagInput id="expense-slug" value={data.slug} onChange={(tags) => { setSlugTouched(true); setData('slug', tags); }} /><InputError message={errors.slug} className="mt-2" /></div>
            <div><InputLabel htmlFor="amount" value="Amount" /><TextInput id="amount" value={data.amount} onChange={(e) => setData('amount', e.target.value)} type="number" min="0" step="any" className="mt-1 block w-full" /><InputError message={errors.amount} className="mt-2" /></div>
            <div><InputLabel htmlFor="currency" value="Currency" /><SelectInput id="currency" value={data.currency} onChange={(e) => setData('currency', e.target.value)} className="mt-1 block w-full"><option value="$">Dollar</option><option value="€">Euro</option><option value="bs">Bolivares</option><option value="$bcv">Dollars indexed at BCV</option><option value="$parallel">Bolivares indexed at parallel rate</option></SelectInput><InputError message={errors.currency} className="mt-2" /></div>
            <div><InputLabel htmlFor="provider" value="Provider" /><SelectInput id="provider" value={data.provider} onChange={(e) => setData('provider', e.target.value)} className="mt-1 block w-full"><option value="auto">Automatic / use both</option><option value="box">Box first</option><option value="savings">Savings first</option></SelectInput><InputError message={errors.provider} className="mt-2" /></div>
            <div><InputLabel htmlFor="recurrence_type" value="Recurrence" /><SelectInput id="recurrence_type" value={data.recurrence_type} onChange={(e) => setData('recurrence_type', e.target.value)} className="mt-1 block w-full"><option value="one_time">One time</option><option value="days">Cycle in days</option><option value="monthly">Specific day of each month</option></SelectInput></div>
            {data.recurrence_type === 'days' && <><div><InputLabel htmlFor="term" value="Claim cycle in days" /><TextInput id="term" value={data.term} onChange={(e) => setData('term', e.target.value)} type="number" min="1" className="mt-1 block w-full" /><InputError message={errors.term} className="mt-2" /></div><div><InputLabel htmlFor="nextterm" value="Days to first claim (optional)" /><TextInput id="nextterm" value={data.nextterm} onChange={(e) => setData('nextterm', e.target.value)} type="number" min="0" className="mt-1 block w-full" /></div></>}
            {data.recurrence_type === 'monthly' && <div><InputLabel htmlFor="claim_day" value="Day of each month" /><TextInput id="claim_day" value={data.claim_day} onChange={(e) => setData('claim_day', e.target.value)} type="number" min="1" max="31" className="mt-1 block w-full" /><p className="mt-1 text-xs text-gray-500">Day 31 uses the month's last day when needed.</p><InputError message={errors.claim_day} className="mt-2" /></div>}
            {data.recurrence_type !== 'one_time' && <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><Checkbox checked={data.auto_claim} onChange={(e) => setData('auto_claim', e.target.checked)} />Claim automatically when due</label>}
            <div className="flex justify-end"><PrimaryButton disabled={processing}>Save</PrimaryButton></div>
        </form>
    );
}
