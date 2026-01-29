import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loginAdmin, clearError } from '@/store/slices/authSlice';
import PageAnimation from '@/components/common/PageAnimation';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

import { Lock, Mail, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [localError, setLocalError] = useState('');

    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { loading, error } = useSelector((state) => state.auth);

    useEffect(() => {
        return () => {
            dispatch(clearError());
        };
    }, [dispatch]);

    const validateEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError('');
        dispatch(clearError());

        if (!email || !password) {
            setLocalError('All fields are required');
            return;
        }

        if (!validateEmail(email)) {
            setLocalError('Please enter a valid email address');
            return;
        }

        try {
            await dispatch(loginAdmin({ email, password })).unwrap();
            navigate('/dashboard');
        } catch (err) {
            // Redux error already handled
        }
    };

    const displayError = localError || error;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
            <PageAnimation className="w-full max-w-md">
                <Card className="w-full shadow-xl">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-3xl font-bold text-center">
                            Admin Login
                        </CardTitle>
                        <CardDescription className="text-center">
                            Sign in to access the admin dashboard
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Email */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="email"
                                        placeholder="admin@example.com"
                                        value={email}
                                        autoComplete="email"
                                        aria-label="Email"
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            setLocalError('');
                                        }}
                                        className="pl-10"
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Enter your password"
                                        value={password}
                                        autoComplete="current-password"
                                        aria-label="Password"
                                        onChange={(e) => {
                                            setPassword(e.target.value);
                                            setLocalError('');
                                        }}
                                        className="pl-10 pr-10"
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-2.5 text-muted-foreground"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Error */}
                            {displayError && (
                                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                                    {displayError}
                                </div>
                            )}

                            {/* Submit */}
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </Button>
                        </form>

                        <div className="mt-6 text-center text-sm text-muted-foreground/50">
                            <p>Protected by secure authentication</p>
                        </div>
                    </CardContent>
                </Card>
            </PageAnimation>
        </div>
    );
}
