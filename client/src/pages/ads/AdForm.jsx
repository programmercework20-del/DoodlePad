import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '@/components/layout/AdminLayout';
import Loader from '@/components/common/Loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adService } from '@/services/ad.service';

const initialForm = {
    title: '',
    description: '',
    imageUrl: '',
    redirectUrl: '',
    type: 'banner',
    budget: '',
    startDate: '',
    endDate: '',
};

export default function AdForm() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = Boolean(id);

    const [form, setForm] = useState(initialForm);
    const [loading, setLoading] = useState(isEditMode);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isEditMode) {
            return;
        }

        const loadAd = async () => {
            try {
                setLoading(true);
                setError('');
                const response = await adService.getAdById(id);
                const ad = response.data;

                setForm({
                    title: ad.title || '',
                    description: ad.description || '',
                    imageUrl: ad.imageUrl || '',
                    redirectUrl: ad.redirectUrl || '',
                    type: ad.type || 'banner',
                    budget: ad.budget || '',
                    startDate: ad.startDate ? ad.startDate.slice(0, 10) : '',
                    endDate: ad.endDate ? ad.endDate.slice(0, 10) : '',
                });
            } catch (requestError) {
                setError(requestError.response?.data?.message || 'Failed to load ad details.');
            } finally {
                setLoading(false);
            }
        };

        loadAd();
    }, [id, isEditMode]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((current) => ({ ...current, [name]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            setSubmitting(true);
            setError('');

            const payload = {
                ...form,
                budget: Number(form.budget),
            };

            if (isEditMode) {
                await adService.updateAd(id, payload);
            } else {
                await adService.createAd(payload);
            }

            navigate('/ads');
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Failed to save ad.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AdminLayout>
            <div className="mx-auto max-w-4xl space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            {isEditMode ? 'Edit Advertisement' : 'Create Advertisement'}
                        </h1>
                        <p className="mt-1 text-gray-500">
                            {isEditMode
                                ? 'Update campaign details and keep payment status intact.'
                                : 'Set up a new ad campaign. It will stay pending until payment is simulated.'}
                        </p>
                    </div>

                    <Button asChild variant="outline">
                        <Link to="/ads">Back to Ads</Link>
                    </Button>
                </div>

                <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
                    <div className="border-b bg-[linear-gradient(135deg,#0f172a,#1d4ed8)] px-6 py-6 text-white">
                        <h2 className="text-xl font-semibold">Campaign Setup</h2>
                        <p className="mt-1 text-sm text-blue-100">
                            Fill in the creative, schedule, and destination details for this advertisement.
                        </p>
                    </div>

                    {loading ? (
                        <Loader size="lg" className="py-16" />
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6 p-6">
                            {error && (
                                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                    {error}
                                </div>
                            )}

                            <div className="grid gap-6 md:grid-cols-2">
                                <FormField label="Title">
                                    <Input
                                        name="title"
                                        value={form.title}
                                        onChange={handleChange}
                                        placeholder="Summer launch banner"
                                        required
                                    />
                                </FormField>

                                <FormField label="Ad Type">
                                    <select
                                        name="type"
                                        value={form.type}
                                        onChange={handleChange}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        <option value="banner">Banner</option>
                                        <option value="feed">Feed</option>
                                        <option value="popup">Popup</option>
                                    </select>
                                </FormField>

                                <FormField label="Image URL">
                                    <Input
                                        name="imageUrl"
                                        value={form.imageUrl}
                                        onChange={handleChange}
                                        placeholder="https://example.com/ad-image.jpg"
                                        required
                                    />
                                </FormField>

                                <FormField label="Redirect URL">
                                    <Input
                                        name="redirectUrl"
                                        value={form.redirectUrl}
                                        onChange={handleChange}
                                        placeholder="https://example.com/landing-page"
                                        required
                                    />
                                </FormField>

                                <FormField label="Budget">
                                    <Input
                                        name="budget"
                                        type="number"
                                        min="1"
                                        step="0.01"
                                        value={form.budget}
                                        onChange={handleChange}
                                        placeholder="5000"
                                        required
                                    />
                                </FormField>

                                <FormField label="Start Date">
                                    <Input
                                        name="startDate"
                                        type="date"
                                        value={form.startDate}
                                        onChange={handleChange}
                                        required
                                    />
                                </FormField>

                                <FormField label="End Date">
                                    <Input
                                        name="endDate"
                                        type="date"
                                        value={form.endDate}
                                        onChange={handleChange}
                                        required
                                    />
                                </FormField>
                            </div>

                            <FormField label="Description">
                                <textarea
                                    name="description"
                                    value={form.description}
                                    onChange={handleChange}
                                    rows={5}
                                    placeholder="Describe the goal, audience, and creative context for this ad."
                                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    required
                                />
                            </FormField>

                            <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
                                <Button type="button" variant="outline" onClick={() => navigate('/ads')}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={submitting}>
                                    {submitting ? 'Saving...' : isEditMode ? 'Update Ad' : 'Create Ad'}
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}

function FormField({ label, children }) {
    return (
        <label className="space-y-2">
            <span className="text-sm font-medium text-gray-700">{label}</span>
            {children}
        </label>
    );
}
