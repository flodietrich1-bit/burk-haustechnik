import type { Addendum, User } from '../types';

export function isAddendumVisibleToRole(item: Addendum, role: User['role']): boolean {
  return role !== 'kaufmaennisch' || Boolean(item.requestedAt || item.status === 'requested' || item.status === 'needs_discussion');
}

export function isAddendumTodoForRole(item: Addendum, role: User['role']): boolean {
  if (!isAddendumVisibleToRole(item, role)) return false;
  if (role === 'kaufmaennisch') return item.status === 'requested';
  if (role === 'admin') return item.status === 'pending' || item.status === 'requested';
  return item.status === 'pending' || item.status === 'needs_discussion';
}
