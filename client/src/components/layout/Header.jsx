import { useSelector } from 'react-redux';
import { User } from 'lucide-react';

export default function Header() {
    const { admin } = useSelector((state) => state.auth);

    return (
        <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-gray-800">Welcome back!</h2>
                    <p className="text-sm text-gray-500">Manage your platform effectively</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="text-sm font-medium text-gray-800">{admin?.name || 'Admin'}</p>
                        <p className="text-xs text-gray-500 capitalize">{admin?.role || 'Administrator'}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                    </div>
                </div>
            </div>
        </header>
    );
}
