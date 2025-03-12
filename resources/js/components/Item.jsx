import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

export default function Item({ earning }) {
    return (
        <div key={earning.id} className="flex items-center justify-between">
            <div>
                <h3 className="text-lg font-semibold">{earning.description}</h3>
                <p className="text-sm text-gray-500">{earning.amount}{earning.currency}</p>
                {earning.term ? (
                    <p className="text-sm text-gray-500">Claim cycle of {earning.term} days</p>
                ) : (
                    <p className="text-sm text-gray-500">Parallel exchange tase of {earning.OneTimeTase}</p>
                )}
                <p className="text-sm text-gray-500">{dayjs(earning.created_at).fromNow()}</p>
            </div>
            <div>
                <button className="text-blue-500 hover:text-blue-600">Edit</button>
                <button className="text-red-500 hover:text-red-600">Delete</button>
            </div>
        </div>
    );
}