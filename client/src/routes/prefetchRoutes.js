export const prefetchRoutes = {
  dashboard: () => import('@/pages/dashboard/Dashboard'),
  users: () => import('@/pages/users/Users'),
  userDetails: () => import('@/pages/users/UserDetails'),
  posts: () => import('@/pages/posts/Posts'),
  comments: () => import('@/pages/comments/Comments'),
  reports: () => import('@/pages/reports/Reports'),
  live: () => import('@/pages/live/LiveSessions'),
  messages: () => import('@/pages/messages/Messages'),
  ads: () => import('@/pages/ads/AdsList'),
  adForm: () => import('@/pages/ads/AdForm'),
  payments: () => import('@/pages/payments/Payments'),
  revenue: () => import('@/pages/revenue/RevenueDashboard'),
};