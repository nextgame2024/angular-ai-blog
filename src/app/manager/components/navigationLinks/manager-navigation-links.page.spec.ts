import { normalizeSophiaAdminHeaderSelection } from './manager-navigation-links.page';

describe('Manager navigation links Sophia Admin revocation', () => {
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
});
