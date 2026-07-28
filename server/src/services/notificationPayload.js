export const buildRealtimeNotificationPayload = (notification, sender) => {
  const base = typeof notification?.toJSON === 'function' ? notification.toJSON() : notification;

  return {
    ...base,
    type: base?.type || notification?.type,
    sender: sender
      ? {
          id: sender.id ?? null,
          name: sender.name ?? null,
          username: sender.username ?? null,
          profilePhoto: sender.profilePhoto ?? null,
        }
      : null,
  };
};
