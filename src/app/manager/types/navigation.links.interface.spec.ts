import {
  HEADER_NAVIGATION_LABEL_OPTIONS,
  MENU_NAVIGATION_LABEL_OPTIONS,
  SOPHIA_ADMIN_MODULE_OPTIONS,
} from './navigation.links.interface';

describe('Sophia Admin navigation entitlement options', () => {
  it('offers one direct header link and all sixteen module scopes', () => {
    expect(
      HEADER_NAVIGATION_LABEL_OPTIONS.some(
        (option) => option.value === 'Sophia Ai admin',
      ),
    ).toBeTrue();
    expect(SOPHIA_ADMIN_MODULE_OPTIONS.length).toBe(16);
    expect(SOPHIA_ADMIN_MODULE_OPTIONS[0].value).toBe('ADM-01');
    expect(SOPHIA_ADMIN_MODULE_OPTIONS[15].value).toBe('ADM-16');
  });

  it('offers Students as a configurable Business Manager menu module', () => {
    expect(MENU_NAVIGATION_LABEL_OPTIONS).toContain(jasmine.objectContaining({
      value: 'Students', label: 'Students',
    }));
  });
});
