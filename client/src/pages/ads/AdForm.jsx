// import { useEffect, useState } from 'react';
// import { Link, useNavigate, useParams } from 'react-router-dom';
// import AdminLayout from '@/components/layout/AdminLayout';
// import Loader from '@/components/common/Loader';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { adService } from '@/services/ad.service';

// const initialForm = {
//     title: '',
//     description: '',
//     imageUrl: '',
//     redirectUrl: '',
//     type: 'banner',
//     budget: '',
//     startDate: '',
//     endDate: '',
// };

// export default function AdForm() {
//     const navigate = useNavigate();
//     const { id } = useParams();
//     const isEditMode = Boolean(id);

//     const [form, setForm] = useState(initialForm);
//     const [loading, setLoading] = useState(isEditMode);
//     const [submitting, setSubmitting] = useState(false);
//     const [error, setError] = useState('');

//     useEffect(() => {
//         if (!isEditMode) {
//             return;
//         }

//         const loadAd = async () => {
//             try {
//                 setLoading(true);
//                 setError('');
//                 const response = await adService.getAdById(id);
//                 const ad = response.data;

//                 setForm({
//                     title: ad.title || '',
//                     description: ad.description || '',
//                     imageUrl: ad.imageUrl || '',
//                     redirectUrl: ad.redirectUrl || '',
//                     type: ad.type || 'banner',
//                     budget: ad.budget || '',
//                     startDate: ad.startDate ? ad.startDate.slice(0, 10) : '',
//                     endDate: ad.endDate ? ad.endDate.slice(0, 10) : '',
//                 });
//             } catch (requestError) {
//                 setError(requestError.response?.data?.message || 'Failed to load ad details.');
//             } finally {
//                 setLoading(false);
//             }
//         };

//         loadAd();
//     }, [id, isEditMode]);

//     const handleChange = (event) => {
//         const { name, value } = event.target;
//         setForm((current) => ({ ...current, [name]: value }));
//     };

//     const handleSubmit = async (event) => {
//         event.preventDefault();
//         try {
//             setSubmitting(true);
//             setError('');

//             const payload = {
//                 ...form,
//                 budget: Number(form.budget),
//             };

//             if (isEditMode) {
//                 await adService.updateAd(id, payload);
//             } else {
//                 await adService.createAd(payload);
//             }

//             navigate('/ads');
//         } catch (requestError) {
//             setError(requestError.response?.data?.message || 'Failed to save ad.');
//         } finally {
//             setSubmitting(false);
//         }
//     };

//     return (
//         <AdminLayout>
//             <div className="mx-auto max-w-4xl space-y-6">
//                 <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
//                     <div>
//                         <h1 className="text-3xl font-bold text-gray-900">
//                             {isEditMode ? 'Edit Advertisement' : 'Create Advertisement'}
//                         </h1>
//                         <p className="mt-1 text-gray-500">
//                             {isEditMode
//                                 ? 'Update campaign details and keep payment status intact.'
//                                 : 'Set up a new ad campaign. It will stay pending until payment is simulated.'}
//                         </p>
//                     </div>

//                     <Button asChild variant="outline">
//                         <Link to="/ads">Back to Ads</Link>
//                     </Button>
//                 </div>

//                 <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
//                     <div className="border-b bg-[linear-gradient(135deg,#0f172a,#1d4ed8)] px-6 py-6 text-white">
//                         <h2 className="text-xl font-semibold">Campaign Setup</h2>
//                         <p className="mt-1 text-sm text-blue-100">
//                             Fill in the creative, schedule, and destination details for this advertisement.
//                         </p>
//                     </div>

//                     {loading ? (
//                         <Loader size="lg" className="py-16" />
//                     ) : (
//                         <form onSubmit={handleSubmit} className="space-y-6 p-6">
//                             {error && (
//                                 <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
//                                     {error}
//                                 </div>
//                             )}

//                             <div className="grid gap-6 md:grid-cols-2">
//                                 <FormField label="Title">
//                                     <Input
//                                         name="title"
//                                         value={form.title}
//                                         onChange={handleChange}
//                                         placeholder="Summer launch banner"
//                                         required
//                                     />
//                                 </FormField>

//                                 <FormField label="Ad Type">
//                                     <select
//                                         name="type"
//                                         value={form.type}
//                                         onChange={handleChange}
//                                         className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
//                                     >
//                                         <option value="banner">Banner</option>
//                                         <option value="feed">Feed</option>
//                                         <option value="popup">Popup</option>
//                                     </select>
//                                 </FormField>

//                                 <FormField label="Image URL">
//                                     <Input
//                                         name="imageUrl"
//                                         value={form.imageUrl}
//                                         onChange={handleChange}
//                                         placeholder="https://example.com/ad-image.jpg"
//                                         required
//                                     />
//                                 </FormField>

//                                 <FormField label="Redirect URL">
//                                     <Input
//                                         name="redirectUrl"
//                                         value={form.redirectUrl}
//                                         onChange={handleChange}
//                                         placeholder="https://example.com/landing-page"
//                                         required
//                                     />
//                                 </FormField>

//                                 <FormField label="Budget">
//                                     <Input
//                                         name="budget"
//                                         type="number"
//                                         min="1"
//                                         step="0.01"
//                                         value={form.budget}
//                                         onChange={handleChange}
//                                         placeholder="5000"
//                                         required
//                                     />
//                                 </FormField>

//                                 <FormField label="Start Date">
//                                     <Input
//                                         name="startDate"
//                                         type="date"
//                                         value={form.startDate}
//                                         onChange={handleChange}
//                                         required
//                                     />
//                                 </FormField>

//                                 <FormField label="End Date">
//                                     <Input
//                                         name="endDate"
//                                         type="date"
//                                         value={form.endDate}
//                                         onChange={handleChange}
//                                         required
//                                     />
//                                 </FormField>
//                             </div>

//                             <FormField label="Description">
//                                 <textarea
//                                     name="description"
//                                     value={form.description}
//                                     onChange={handleChange}
//                                     rows={5}
//                                     placeholder="Describe the goal, audience, and creative context for this ad."
//                                     className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
//                                     required
//                                 />
//                             </FormField>

//                             <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
//                                 <Button type="button" variant="outline" onClick={() => navigate('/ads')}>
//                                     Cancel
//                                 </Button>
//                                 <Button type="submit" disabled={submitting}>
//                                     {submitting ? 'Saving...' : isEditMode ? 'Update Ad' : 'Create Ad'}
//                                 </Button>
//                             </div>
//                         </form>
//                     )}
//                 </div>
//             </div>
//         </AdminLayout>
//     );
// }

// function FormField({ label, children }) {
//     return (
//         <label className="space-y-2">
//             <span className="text-sm font-medium text-gray-700">{label}</span>
//             {children}
//         </label>
//     );
// }




import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { toast } from 'react-toastify';

import AdminLayout from '@/components/layout/AdminLayout';
import Loader from '@/components/common/Loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adService } from '@/services/ad.service';

// 🔥 Validation Schema
const schema = yup.object({
  title: yup.string().required('Title is required'),
  description: yup.string().required('Description is required'),
  imageUrl: yup.string().url('Invalid URL').required('Image URL required'),
  redirectUrl: yup.string().url('Invalid URL').required('Redirect URL required'),
  budget: yup.number().typeError('Must be number').min(1, 'Min 1').required(),
  startDate: yup.string().required(),
  endDate: yup.string().required(),
  type: yup.string().required(),
});

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

  const [loading, setLoading] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors }
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: initialForm
  });

  // 👀 Image Preview (real-time)
  const imageUrl = watch("imageUrl");

  useEffect(() => {
    if (imageUrl) {
      setPreview(imageUrl);
    }
  }, [imageUrl]);

  // 🔥 Load data
  useEffect(() => {
    if (!isEditMode) return;

    const loadAd = async () => {
      try {
        setLoading(true);
        const res = await adService.getAdById(id);
        const ad = res.data;

        reset({
          title: ad.title || '',
          description: ad.description || '',
          imageUrl: ad.imageUrl || '',
          redirectUrl: ad.redirectUrl || '',
          type: ad.type || 'banner',
          budget: ad.budget || '',
          startDate: ad.startDate?.slice(0, 10) || '',
          endDate: ad.endDate?.slice(0, 10) || '',
        });

        setPreview(ad.imageUrl || '');
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load ad.');
        toast.error('Failed to load ad ❌');
      } finally {
        setLoading(false);
      }
    };

    loadAd();
  }, [id, isEditMode, reset]);

  // 🔥 Submit
  const onSubmit = async (data) => {
    try {
      setSubmitting(true);

      const payload = {
        ...data,
        budget: Number(data.budget),
      };

      if (isEditMode) {
        await adService.updateAd(id, payload);
        toast.success('Ad updated successfully ✅');
      } else {
        await adService.createAd(payload);
        toast.success('Ad created successfully 🚀');
      }

      navigate('/ads');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong ❌');
    } finally {
      setSubmitting(false);
    }
  };

  function ErrorMsg({ msg }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}

function FormField({ label, children }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-textMain">{label}</label>
      {children}
    </div>
  );
}

return (
  <AdminLayout>
    <div className="mx-auto max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-textMain">
            {isEditMode ? 'Edit Advertisement' : 'Create Advertisement'}
          </h1>
          <p className="text-textSecondary text-sm">
            Manage your campaign details professionally
          </p>
        </div>

        <Button asChild variant="outline" className="border-inputBorder hover:bg-surface">
          <Link to="/ads">← Back</Link>
        </Button>
      </div>

      {/* Card */}
      <div className="rounded-3xl border border-inputBorder bg-background shadow-lg overflow-hidden">

        {/* Top Gradient Header */}
        <div className="bg-gradient-to-r from-primary to-secondary px-6 py-6 text-white">
          <h2 className="text-lg font-semibold">Campaign Setup</h2>
          <p className="text-sm opacity-80">
            Fill all required details for your advertisement
          </p>
        </div>

        {loading ? (
          <Loader size="lg" className="py-20" />
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-8">

            {/* Grid Section */}
            <div className="grid md:grid-cols-2 gap-6">

              {/* Title */}
              <FormField label="Title">
                <Input
                  placeholder="title of the ad"
                  className="bg-inputBg border-inputBorder focus:ring-2 focus:ring-primary"
                  {...register("title")}
                />
                <ErrorMsg msg={errors.title?.message} />
              </FormField>

              {/* Type */}
              <FormField label="Ad Type">
                <select
                  {...register("type")}
                  className="h-10 w-full rounded-md border border-inputBorder bg-inputBg px-3 text-sm focus:ring-2 focus:ring-primary"
                >
                  <option value="banner">Banner</option>
                  <option value="feed">Feed</option>
                  <option value="popup">Popup</option>
                </select>
              </FormField>

              {/* Image */}
              <FormField label="Image URL">
                <Input
                  placeholder="https://image.com/banner.jpg"
                  className="bg-inputBg border-inputBorder focus:ring-2 focus:ring-primary"
                  {...register("imageUrl")}
                />
                <ErrorMsg msg={errors.imageUrl?.message} />
              </FormField>

              {/* Redirect */}
              <FormField label="Redirect URL">
                <Input
                  placeholder="https://your-landing.com"
                  className="bg-inputBg border-inputBorder focus:ring-2 focus:ring-primary"
                  {...register("redirectUrl")}
                />
                <ErrorMsg msg={errors.redirectUrl?.message} />
              </FormField>

              {/* Budget */}
              <FormField label="Budget (₹)">
                <Input
                  type="number"
                  className="bg-inputBg border-inputBorder focus:ring-2 focus:ring-primary"
                  {...register("budget")}
                />
                <ErrorMsg msg={errors.budget?.message} />
              </FormField>

              {/* Start Date */}
              <FormField label="Start Date">
                <Input
                  type="date"
                  className="bg-inputBg border-inputBorder focus:ring-2 focus:ring-primary"
                  {...register("startDate")}
                />
              </FormField>

              {/* End Date */}
              <FormField label="End Date">
                <Input
                  type="date"
                  className="bg-inputBg border-inputBorder focus:ring-2 focus:ring-primary"
                  {...register("endDate")}
                />
              </FormField>

            </div>

            {/* Image Preview */}
            {preview && (
              <div className="rounded-xl border border-inputBorder bg-surface p-4">
                <p className="text-sm text-textSecondary mb-2">Preview</p>
                <img
                  src={preview}
                  alt="preview"
                  className="w-full h-64 object-cover rounded-lg shadow-sm"
                />
              </div>
            )}

            {/* Description */}
            <FormField label="Description">
              <textarea
                rows={4}
                className="w-full rounded-md border border-inputBorder bg-inputBg px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                {...register("description")}
                maxLength={255}
              />
              <ErrorMsg msg={errors.description?.message} />
            </FormField>

            {/* Buttons */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end border-t pt-6">

              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/ads')}
                className="border-inputBorder hover:bg-surface"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={submitting}
                className="bg-primary hover:bg-red-700 text-white"
              >
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