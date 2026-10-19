import { TestBed } from '@angular/core/testing';
import { ListNavigationStateService } from './list-navigation-state.service';
import { PersistanceService } from './persistance.service';

describe('ListNavigationStateService', () => {
  it('keeps independent navigation snapshots and clears them when the login changes', () => {
    let identity: string | null = 'first-login';
    TestBed.configureTestingModule({ providers: [{ provide: PersistanceService, useValue: { get: () => identity } }] });
    const state = TestBed.inject(ListNavigationStateService);
    const query = { page: 20, limit: 25, search: 'Example' };
    state.save('students', query); state.save('payments', { page: 5 });
    query.page = 1;
    expect(state.read('students')).toEqual({ page: 20, limit: 25, search: 'Example' });
    expect(state.read('payments')).toEqual({ page: 5 });
    identity = null;
    expect(state.read('students')).toBeUndefined();
    identity = 'second-login';
    expect(state.read('payments')).toBeUndefined();
  });
});
