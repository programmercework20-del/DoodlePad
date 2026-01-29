import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ title, value, icon: Icon, trend, trendValue, className }) {
    const isPositive = trend === 'up';

    return (
        <Card className={className}>
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <h3 className="text-3xl font-bold mt-2">{value}</h3>
                        {trendValue && (
                            <div className={`flex items-center mt-2 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                {isPositive ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                                <span>{trendValue}</span>
                            </div>
                        )}
                    </div>
                    {Icon && (
                        <div className="p-3 bg-primary/10 rounded-lg">
                            <Icon className="h-6 w-6 text-primary" />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
