import { useSelector, useDispatch } from 'react-redux';
import { User } from 'lucide-react';
// Agar tumhara koi Redux logout action hai toh usko bhi import kar lena
// import { clearCredentials } from '../../store/authSlice'; 

export default function Header() {
    const { admin } = useSelector((state) => state.auth);
    const dispatch = useDispatch();

    const handleLogout = async () => {
        try {
            // 🔥 FIX 1: Full Backend API URL use karna hai
            await fetch('https://doodlepad.programmerce.com/api/admin/logout', {
                method: 'POST',
                credentials: 'include',
            });
        } catch (error) {
            console.error("Logout failed at server:", error);
        } finally {
            // 🔥 FIX 2: Redux aur LocalStorage ko strictly clear karo
            // dispatch(clearCredentials()); // Agar action bana hai toh use uncomment karo
            localStorage.clear(); 
            sessionStorage.clear();
            
            // Redirect to login
            window.location.assign('/admin/login');
        }
    };

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
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                    >
                        Logout
                    </button>
                </div>
            </div>
        </header>
    );
}