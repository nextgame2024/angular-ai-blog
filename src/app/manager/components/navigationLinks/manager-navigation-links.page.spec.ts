import {
  ALL_ACTIVE_USERS_VALUE,
  canConfigurePlatformAdmin,
  normalizeSophiaAdminHeaderSelection,
  withAllActiveUsersOption,
} from './manager-navigation-links.page';

describe('Manager navigation links Sophia Admin revocation', () => {
  it('permits platform authority only for the super administrator own company', () => {
    expect(canConfigurePlatformAdmin(true, 'admin-company', 'admin-company')).toBeTrue();
    expect(canConfigurePlatformAdmin(true, 'admin-company', 'customer-company')).toBeFalse();
    expect(canConfigurePlatformAdmin(false, 'admin-company', 'admin-company')).toBeFalse();
  });

  it('removes the Sophia Admin header link when the final module is cleared', () => {
    const labels = normalizeSophiaAdminHeaderSelection(
      ['Business manager', 'Sophia Ai admin'],
      0,
      true,
      'header',
    );

    expect(Array.from(labels)).toEqual(['Business manager']);
  });

  it('retains the Sophia Admin header link while at least one module remains', () => {
    const labels = normalizeSophiaAdminHeaderSelection(
      ['Business manager', 'Sophia Ai admin'],
      1,
      true,
      'header',
    );

    expect(labels.has('Sophia Ai admin')).toBeTrue();
  });

  it('adds an explicit bulk option without replacing individual users', () => {
    const options = withAllActiveUsersOption([
      { value: 'user-1', label: 'First user' },
      { value: 'user-2', label: 'Second user' },
    ]);

    expect(options.map((option) => option.value)).toEqual([
      ALL_ACTIVE_USERS_VALUE,
      'user-1',
      'user-2',
    ]);
    expect(options[0].label).toBe('All active users (2)');
  });
});
