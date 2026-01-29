import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loginAdmin, clearError } from '@/store/slices/authSlice';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, Mail } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [localError, setLocalError] = useState('');

    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { loading, error } = useSelector((state) => state.auth);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError('');
        dispatch(clearError());

        if (!email || !password) {
            setLocalError('Please fill in all fields');
            return;
        }

        const result = await dispatch(loginAdmin({ email, password }));

        if (result.type === 'auth/login/fulfilled') {
            navigate('/dashboard');
        }
    };

    const displayError = error || localError;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-3xl font-bold text-center">Admin Login</CardTitle>
                    <CardDescription className="text-center">
                        Enter your credentials to access the admin panel
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="email"
                                    placeholder="admin@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="password"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {displayError && (
                            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                                {displayError}
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Signing in...' : 'Sign In'}
                        </Button>
                    </form>

                    <div className="mt-6 text-center text-sm text-muted-foreground">
                        <p>Default credentials:</p>
                        <p className="mt-1">Email: admin@example.com</p>
                        <p>Password: Admin@123</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
