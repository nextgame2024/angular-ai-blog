import { ManagerActions } from './manager.actions';
import { managerReducer } from './manager.reducer';
import { initialManagerState } from './manager.state';
import type { BmUser } from '../services/manager.service';

describe('Manager Users pagination', () => {
  const user = (id: string): BmUser => ({ id, username: id, name: id, status: 'active' } as BmUser);

  it('replaces the prior page instead of appending it', () => {
    const first = managerReducer(initialManagerState, ManagerActions.loadUsersSuccess({
      result: { items: [user('one')], page: 1, limit: 25, total: 2 },
    }));
    const second = managerReducer(first, ManagerActions.loadUsersSuccess({
      result: { items: [user('two')], page: 2, limit: 25, total: 2 },
    }));
    expect(second.users.map((item) => item.id)).toEqual(['two']);
  });

  it('removes an archived user from the visible page and count', () => {
    const loaded = managerReducer(initialManagerState, ManagerActions.loadUsersSuccess({
      result: { items: [user('one'), user('two')], page: 1, limit: 25, total: 2 },
    }));
    const archived = managerReducer(loaded, ManagerActions.archiveUserSuccess({ userId: 'one', action: 'archived' }));
    expect(archived.users.map((item) => item.id)).toEqual(['two']);
    expect(archived.usersTotal).toBe(1);
  });
});
